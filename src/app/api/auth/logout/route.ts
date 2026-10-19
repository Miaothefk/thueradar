import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/prisma';
import { destroySessionByToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. Follow docs/DB_SETUP.md' }, { status: 503 });
  }

  // Try to read the cookie token
  let token: string | undefined;
  try {
    token = req.cookies.get ? req.cookies.get(COOKIE_NAME)?.value : undefined;
  } catch {
    const header = req.headers.get('cookie') || '';
    const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    token = match ? match[1] : undefined;
  }

  if (token) {
    await destroySessionByToken(token).catch(() => {});
  }

  // To remove cookie from client, set it with Max-Age=0
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = `${COOKIE_NAME}=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
  const res = NextResponse.json({ ok: true, message: 'Logged out' });
  res.headers.set('Set-Cookie', cookie);
  return res;
}
