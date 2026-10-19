import { PrismaClient } from '@prisma/client';

// Export a safe getter that returns null when DATABASE_URL is not configured.
// This prevents accidental DB connections in unenvironed environments.

const isDbConfigured = Boolean(process.env.DATABASE_URL);

declare global {
  var __thueradar_prisma: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient | null {
  if (!isDbConfigured) return null;
  const g = globalThis as typeof globalThis & { __thueradar_prisma?: PrismaClient };
  if (!g.__thueradar_prisma) {
    g.__thueradar_prisma = new PrismaClient();
  }
  return g.__thueradar_prisma;
}

export function isDatabaseConfigured(): boolean {
  return isDbConfigured;
}
