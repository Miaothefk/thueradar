import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { recordAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ notifications, unread: notifications.filter((item) => item.status === "UNREAD").length });
}

export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Thiếu id thông báo." }, { status: 400 });
  const updated = await prisma.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { status: "READ", readAt: new Date() } });
  if (!updated.count) return NextResponse.json({ error: "Không tìm thấy thông báo." }, { status: 404 });
  await recordAudit(prisma, { action: "READ_NOTIFICATION", entity: "Notification", userId: user.id, metadata: { notificationId: body.id } });
  return NextResponse.json({ read: true });
}
