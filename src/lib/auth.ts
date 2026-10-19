import crypto from 'crypto';
import { getPrisma, isDatabaseConfigured } from './prisma';

const SESSION_COOKIE_NAME = 'thueradar_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, key] = stored.split(':');
    if (!salt || !key) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const original = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(derived, original);
  } catch {
    return false;
  }
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function createSessionForUser(userId: string) {
  if (!isDatabaseConfigured()) throw new Error('Database not configured');
  const prisma = getPrisma();
  if (!prisma) throw new Error('Prisma client not available');

  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  // Build cookie string to be set by the route handler. We return both so tests can inspect token.
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${isProd ? '; Secure' : ''}`;

  return { token, tokenHash, cookie };
}

export async function destroySessionByToken(token: string) {
  if (!isDatabaseConfigured()) throw new Error('Database not configured');
  const prisma = getPrisma();
  if (!prisma) throw new Error('Prisma client not available');
  const tokenHash = sha256Hex(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getUserBySessionToken(token: string) {
  if (!isDatabaseConfigured()) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const tokenHash = sha256Hex(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // expired
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export function buildSessionCookieHeader(token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${isProd ? '; Secure' : ''}`;
}

export const COOKIE_NAME = SESSION_COOKIE_NAME;
