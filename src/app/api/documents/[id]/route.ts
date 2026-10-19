import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, isDatabaseConfigured } from '@/lib/prisma';
import { getUserBySessionToken } from '@/lib/auth';
import { isAdmin, isReviewer } from '@/lib/authorization';

async function currentUser(req: NextRequest) {
  const token = req.cookies.get('thueradar_session')?.value;
  return token ? getUserBySessionToken(token) : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });

  const user = await currentUser(req);
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      source: true,
      versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, createdAt: true } },
    },
  });
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const canView = document.status === 'VERIFIED'
    || Boolean(user && (isAdmin(user) || isReviewer(user) || user.id === document.ownerId));
  if (!canView) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ document, dataSource: 'database' });
}
