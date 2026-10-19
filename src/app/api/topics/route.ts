import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  return NextResponse.json({ topics: await prisma.topicFollow.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) });
}
