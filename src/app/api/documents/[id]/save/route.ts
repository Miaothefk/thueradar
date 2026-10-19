import { NextRequest, NextResponse } from 'next/server';
import { getPrisma, isDatabaseConfigured } from '@/lib/prisma';
import { getRequestUser } from '@/lib/request-auth';
import { recordAudit } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!document || document.status !== 'VERIFIED') return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const saved = await prisma.savedDocument.upsert({
    where: { userId_documentId: { userId: user.id, documentId: id } },
    create: { userId: user.id, documentId: id },
    update: {},
  });
  await recordAudit(prisma, { action: 'SAVE_DOCUMENT', entity: 'SavedDocument', userId: user.id, documentId: id });
  return NextResponse.json({ saved: true, savedDocumentId: saved.id });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 503 });
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ saved: false });
  const { id } = await params;
  const saved = await prisma.savedDocument.findUnique({ where: { userId_documentId: { userId: user.id, documentId: id } }, select: { id: true } });
  return NextResponse.json({ saved: Boolean(saved) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  }
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.savedDocument.deleteMany({ where: { userId: user.id, documentId: id } });
  await recordAudit(prisma, { action: 'UNSAVE_DOCUMENT', entity: 'SavedDocument', userId: user.id, documentId: id });
  return NextResponse.json({ saved: false });
}
