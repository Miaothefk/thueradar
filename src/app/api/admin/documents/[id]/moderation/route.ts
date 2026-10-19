import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { isAdmin, isReviewer } from "@/lib/authorization";

const allowedStatuses = ["DRAFT", "IN_REVIEW", "VERIFIED", "ARCHIVED"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user || (!isAdmin(user) && !isReviewer(user))) return NextResponse.json({ error: "Chỉ REVIEWER hoặc ADMIN được kiểm duyệt." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: unknown; note?: unknown } | null;
  if (!body || !allowedStatuses.includes(body.status as typeof allowedStatuses[number])) return NextResponse.json({ error: "Trạng thái văn bản không hợp lệ." }, { status: 400 });
  const document = await prisma.document.findUnique({ where: { id }, select: { id: true, title: true, taxTopic: true, status: true } });
  if (!document) return NextResponse.json({ error: "Không tìm thấy văn bản." }, { status: 404 });
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.document.update({ where: { id }, data: { status: body.status as typeof allowedStatuses[number] } });
    await tx.auditEvent.create({ data: { action: "MODERATE_DOCUMENT", entity: "Document", documentId: id, userId: user.id, metadata: { from: document.status, to: next.status, note: typeof body?.note === "string" ? body.note.slice(0, 1000) : null } } });
    if (next.status === "VERIFIED" && document.status !== "VERIFIED" && document.taxTopic) {
      const followers = await tx.topicFollow.findMany({ where: { topic: document.taxTopic }, select: { userId: true } });
      if (followers.length) await tx.notification.createMany({ data: followers.map((follower) => ({ userId: follower.userId, title: "Có văn bản mới trong chủ đề bạn theo dõi", message: document.title, link: `/documents/${id}`, metadata: { documentId: id, topic: document.taxTopic } })) });
    }
    return next;
  });
  return NextResponse.json({ document: updated });
}
