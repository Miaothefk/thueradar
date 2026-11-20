import type { Prisma, PrismaClient } from "@prisma/client";
import { buildNoEvidenceResponse, validateCitations } from "./citation-policy.mjs";
import { AiProviderError, createAiProvider } from "./provider.mjs";

export type RetrievedSource = {
  id: string;
  title: string;
  content: string;
  documentNumber: string | null;
  sourceName: string;
  sourceUrl: string | null;
  legalStatus: string;
};

export type RagResponse = {
  status: "ANSWERED" | "NO_EVIDENCE" | "PROVIDER_NOT_CONFIGURED" | "PROVIDER_ERROR" | "INVALID_CITATIONS";
  answer: string;
  citations: Array<RetrievedSource & { citationId: string }>;
  errorCode?: string;
};

function tokens(question: string) {
  return [...new Set(question.toLocaleLowerCase("vi-VN").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3))].slice(0, 12);
}

export async function retrieveSources(prisma: PrismaClient, question: string, limit = 8): Promise<RetrievedSource[]> {
  const words = tokens(question);
  if (!words.length) return [];
  const where: Prisma.DocumentWhereInput = {
    status: "VERIFIED",
    legalStatus: { notIn: ["EXPIRED", "REPEALED", "SUPERSEDED"] },
    content: { not: null },
    OR: words.flatMap((word) => [
      { title: { contains: word, mode: "insensitive" } },
      { content: { contains: word, mode: "insensitive" } },
      { summary: { contains: word, mode: "insensitive" } },
      { taxTopic: { contains: word, mode: "insensitive" } },
    ]),
  };
  const documents = await prisma.document.findMany({
    where,
    take: Math.min(Math.max(limit, 1), 20),
    orderBy: [{ effectiveAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true, title: true, content: true, documentNumber: true,
      legalStatus: true,
      source: { select: { name: true, url: true } },
    },
  });
  return documents
    .filter((document): document is typeof document & { content: string } => Boolean(document.content))
    .map((document) => ({
      id: document.id,
      title: document.title,
      content: document.content,
      documentNumber: document.documentNumber,
      sourceName: document.source?.name || "Nguồn chưa định danh",
      sourceUrl: document.source?.url || null,
      legalStatus: document.legalStatus,
    }));
}

export async function answerQuestion(
  prisma: PrismaClient,
  question: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): Promise<RagResponse> {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) return buildNoEvidenceResponse("Câu hỏi không được để trống.") as RagResponse;
  const sources = await retrieveSources(prisma, normalizedQuestion);
  if (!sources.length) return buildNoEvidenceResponse() as RagResponse;

  const provider = createAiProvider(env, fetchImpl);
  if (!provider) {
    return {
      status: "PROVIDER_NOT_CONFIGURED",
      answer: "Kho văn bản đã có nguồn phù hợp nhưng AI provider chưa được cấu hình. Chưa phát sinh câu trả lời AI.",
      citations: sources.map((source, index) => ({ ...source, citationId: `D${index + 1}` })),
    };
  }

  const promptSources = sources.map((source, index) => ({ ...source, id: `D${index + 1}` }));
  let answer: string;
  try {
    answer = await provider.generateAnswer({ question: normalizedQuestion, sources: promptSources });
  } catch (error) {
    const providerError = error instanceof AiProviderError ? error : new AiProviderError("AI provider gặp lỗi.");
    return { status: "PROVIDER_ERROR", answer: "Không thể tạo câu trả lời vì AI provider gặp lỗi. Vui lòng thử lại sau.", citations: [], errorCode: providerError.code };
  }
  const validation = validateCitations(answer, promptSources);
  if (!validation.isValid) {
    return {
      status: "INVALID_CITATIONS",
      answer: "Câu trả lời của AI không vượt qua kiểm tra trích dẫn. Không hiển thị nội dung chưa kiểm chứng.",
      citations: [],
      errorCode: validation.invalidIds.length ? "UNKNOWN_CITATION" : "MISSING_CITATION",
    };
  }
  return {
    status: "ANSWERED",
    answer,
    citations: promptSources.filter((source) => validation.citedIds.includes(source.id)).map((source) => ({ ...source, citationId: source.id })),
  };
}
