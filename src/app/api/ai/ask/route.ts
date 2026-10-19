import { NextRequest, NextResponse } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import { answerQuestion } from "@/lib/ai/rag";
import { getRequestUser } from "@/lib/request-auth";
import { recordAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { status: "NOT_CONFIGURED", error: "Database chưa được cấu hình. Chưa thể truy hồi nguồn pháp luật." },
      { status: 503 },
    );
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ status: "NOT_CONFIGURED", error: "Prisma client chưa sẵn sàng." }, { status: 503 });

  const body = await request.json().catch(() => null) as { question?: unknown } | null;
  if (typeof body?.question !== "string" || !body.question.trim()) {
    return NextResponse.json({ status: "INVALID_REQUEST", error: "Vui lòng nhập câu hỏi." }, { status: 400 });
  }

  const result = await answerQuestion(prisma, body.question);
  const user = await getRequestUser(request);
  let answerId: string | undefined;
  if (result.status === "ANSWERED") {
    const answer = await prisma.aiAnswer.create({
      data: { question: body.question.trim(), answer: result.answer, citations: result.citations, userId: user?.id ?? null },
    });
    answerId = answer.id;
    await recordAudit(prisma, { action: "CREATE_AI_ANSWER", entity: "AiAnswer", userId: user?.id, metadata: { answerId } });
  }
  const httpStatus = result.status === "PROVIDER_ERROR" ? 502 : 200;
  return NextResponse.json({ ...result, answerId }, { status: httpStatus });
}
