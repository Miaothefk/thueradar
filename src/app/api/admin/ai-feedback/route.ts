import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { isAdmin, isReviewer } from "@/lib/authorization";
import { recordAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user || (!isAdmin(user) && !isReviewer(user))) return NextResponse.json({ error: "Chỉ REVIEWER hoặc ADMIN được xem báo cáo." }, { status: 403 });
  const feedback = await prisma.aiFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { answer: true, user: { select: { id: true, email: true } } } });
  return NextResponse.json({ feedback });
}

export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user || (!isAdmin(user) && !isReviewer(user))) return NextResponse.json({ error: "Chỉ REVIEWER hoặc ADMIN được kiểm duyệt." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  if (typeof body?.id !== "string" || !["IN_REVIEW", "RESOLVED", "DISMISSED"].includes(String(body.status))) return NextResponse.json({ error: "Trạng thái kiểm duyệt không hợp lệ." }, { status: 400 });
  const feedback = await prisma.aiFeedback.update({ where: { id: body.id }, data: { status: body.status as "IN_REVIEW" | "RESOLVED" | "DISMISSED", reviewedById: user.id, reviewedAt: new Date() } });
  await recordAudit(prisma, { action: "MODERATE_AI_FEEDBACK", entity: "AiFeedback", userId: user.id, metadata: { feedbackId: feedback.id, status: feedback.status } });
  return NextResponse.json({ feedback });
}
