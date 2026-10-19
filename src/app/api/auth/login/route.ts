import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, getPrisma } from '@/lib/prisma';
import { verifyPassword, createSessionForUser, buildSessionCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. Follow docs/DB_SETUP.md' }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const ok = verifyPassword(body.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const { token } = await createSessionForUser(user.id);
  const cookie = buildSessionCookieHeader(token);

  const res = NextResponse.json({ ok: true, message: 'Logged in' });
  res.headers.set('Set-Cookie', cookie);
  return res;
}
