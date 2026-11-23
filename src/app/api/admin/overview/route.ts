import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-auth";
import { isAdmin } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: "Prisma client chưa sẵn sàng." }, { status: 503 });
  const user = await getRequestUser(request);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Chỉ ADMIN được xem bảng điều khiển." }, { status: 403 });

  const [pendingDocuments, inReviewDocuments, verifiedDocuments, openFeedback, resolvedFeedback, lastSchedulerRun] = await Promise.all([
    prisma.document.count({ where: { status: "DRAFT" } }),
    prisma.document.count({ where: { status: "IN_REVIEW" } }),
    prisma.document.count({ where: { status: "VERIFIED" } }),
    prisma.aiFeedback.count({ where: { status: "OPEN" } }),
    prisma.aiFeedback.count({ where: { status: { in: ["RESOLVED", "DISMISSED"] } } }),
    prisma.schedulerRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return NextResponse.json({
    pendingDocuments,
    inReviewDocuments,
    verifiedDocuments,
    openFeedback,
    resolvedFeedback,
    lastSchedulerRun: lastSchedulerRun ? {
      id: lastSchedulerRun.id,
      status: lastSchedulerRun.status,
      trigger: lastSchedulerRun.trigger,
      attempt: lastSchedulerRun.attempt,
      startedAt: lastSchedulerRun.startedAt,
      finishedAt: lastSchedulerRun.finishedAt,
      error: lastSchedulerRun.error,
    } : null,
  });
}
