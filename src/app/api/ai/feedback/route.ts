import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { recordAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập để đánh giá hoặc báo cáo." }, { status: 401 });
  const body = await request.json().catch(() => null) as { answerId?: unknown; kind?: unknown; rating?: unknown; reason?: unknown; details?: unknown } | null;
  if (typeof body?.answerId !== "string" || (body.kind !== "RATING" && body.kind !== "REPORT")) return NextResponse.json({ error: "Dữ liệu đánh giá không hợp lệ." }, { status: 400 });
  const answer = await prisma.aiAnswer.findUnique({ where: { id: body.answerId }, select: { id: true } });
  if (!answer) return NextResponse.json({ error: "Không tìm thấy câu trả lời AI." }, { status: 404 });
  const rating = body.kind === "RATING" && Number.isInteger(body.rating) && Number(body.rating) >= 1 && Number(body.rating) <= 5 ? Number(body.rating) : null;
  if (body.kind === "RATING" && rating === null) return NextResponse.json({ error: "Điểm đánh giá phải từ 1 đến 5." }, { status: 400 });
  if (body.kind === "REPORT" && (typeof body.reason !== "string" || !body.reason.trim())) return NextResponse.json({ error: "Báo cáo phải có lý do." }, { status: 400 });
  const feedback = await prisma.aiFeedback.upsert({
    where: { answerId_userId_kind: { answerId: answer.id, userId: user.id, kind: body.kind } },
    create: { answerId: answer.id, userId: user.id, kind: body.kind, rating, reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null, details: typeof body.details === "string" ? body.details.trim().slice(0, 2000) : null },
    update: { rating, reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null, details: typeof body.details === "string" ? body.details.trim().slice(0, 2000) : null, status: "OPEN", reviewedAt: null, reviewedById: null },
  });
  await recordAudit(prisma, { action: body.kind === "REPORT" ? "REPORT_AI_ANSWER" : "RATE_AI_ANSWER", entity: "AiFeedback", userId: user.id, metadata: { feedbackId: feedback.id, answerId: answer.id } });
  return NextResponse.json({ feedbackId: feedback.id, status: feedback.status });
}
