import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, isDatabaseConfigured } from '@/lib/prisma';
import { getUserBySessionToken } from '@/lib/auth';
import { isAdmin, isReviewer } from '@/lib/authorization';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });

  const token = req.cookies.get('thueradar_session')?.value;
  const user = token ? await getUserBySessionToken(token) : null;
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id }, select: { status: true, ownerId: true } });
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (document.status !== 'VERIFIED' && !(user && (isAdmin(user) || isReviewer(user) || user.id === document.ownerId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, title: true, content: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({ versions, dataSource: 'database' });
}
