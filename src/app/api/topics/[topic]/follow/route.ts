import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { recordAudit } from "@/lib/audit";

async function getContext(request: NextRequest, params: Promise<{ topic: string }>) {
  if (!isDatabaseConfigured()) return { error: NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 }) };
  const prisma = getPrisma();
  if (!prisma) return { error: NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 }) };
  const user = await getRequestUser(request);
  if (!user) return { error: NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 }) };
  const { topic } = await params;
  const normalizedTopic = decodeURIComponent(topic).trim();
  if (!normalizedTopic || normalizedTopic.length > 120) return { error: NextResponse.json({ error: "Chủ đề không hợp lệ." }, { status: 400 }) };
  return { prisma, user, topic: normalizedTopic };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ topic: string }> }) {
  const result = await getContext(request, params);
  if ("error" in result) return result.error;
  const follow = await result.prisma.topicFollow.upsert({
    where: { userId_topic: { userId: result.user.id, topic: result.topic } },
    create: { userId: result.user.id, topic: result.topic },
    update: {},
  });
  await recordAudit(result.prisma, { action: "FOLLOW_TOPIC", entity: "TopicFollow", userId: result.user.id, metadata: { topic: result.topic } });
  return NextResponse.json({ following: true, topic: follow.topic });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ topic: string }> }) {
  const result = await getContext(request, params);
  if ("error" in result) return result.error;
  await result.prisma.topicFollow.deleteMany({ where: { userId: result.user.id, topic: result.topic } });
  await recordAudit(result.prisma, { action: "UNFOLLOW_TOPIC", entity: "TopicFollow", userId: result.user.id, metadata: { topic: result.topic } });
  return NextResponse.json({ following: false, topic: result.topic });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ topic: string }> }) {
  const result = await getContext(request, params);
  if ("error" in result) return result.error;
  const follow = await result.prisma.topicFollow.findUnique({ where: { userId_topic: { userId: result.user.id, topic: result.topic } } });
  return NextResponse.json({ following: Boolean(follow), topic: result.topic });
}
