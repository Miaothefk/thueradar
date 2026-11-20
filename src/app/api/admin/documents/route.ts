import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { isAdmin, isReviewer } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user || (!isAdmin(user) && !isReviewer(user))) return NextResponse.json({ error: "Chỉ REVIEWER hoặc ADMIN được xem danh sách kiểm duyệt." }, { status: 403 });

  const documents = await prisma.document.findMany({
    where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
    select: {
      id: true,
      title: true,
      documentNumber: true,
      documentType: true,
      issuingAuthority: true,
      content: true,
      status: true,
      legalStatus: true,
      validityCheckedAt: true,
      validityEvidenceUrl: true,
      validityMethod: true,
      source: { select: { name: true, url: true, isOfficial: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ documents });
}
