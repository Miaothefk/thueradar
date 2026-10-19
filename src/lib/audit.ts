import type { Prisma, PrismaClient } from "@prisma/client";

export async function recordAudit(
  prisma: PrismaClient,
  input: { action: string; entity: string; userId?: string | null; documentId?: string | null; metadata?: Record<string, unknown> },
) {
  return prisma.auditEvent.create({
    data: {
      action: input.action,
      entity: input.entity,
      userId: input.userId ?? null,
      documentId: input.documentId ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
