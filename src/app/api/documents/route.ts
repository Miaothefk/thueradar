import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { isDatabaseConfigured, getPrisma } from '@/lib/prisma';
import { getUserBySessionToken } from '@/lib/auth';
import { isAdmin, isReviewer } from '@/lib/authorization';

async function getTokenFromRequest(req: NextRequest) {
  try {
    return req.cookies.get ? req.cookies.get('thueradar_session')?.value : undefined;
  } catch {
    const header = req.headers.get('cookie') || '';
    const match = header.match(/thueradar_session=([^;]+)/);
    return match ? match[1] : undefined;
  }
}

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const taxTopic = searchParams.get('taxTopic')?.trim();
  const documentType = searchParams.get('documentType')?.trim();
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const requestedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, 50)
    : 12;
  const token = await getTokenFromRequest(req);
  const user = token ? await getUserBySessionToken(token) : null;

  const conditions: Prisma.DocumentWhereInput[] = [];
  if (!user || (!isAdmin(user) && !isReviewer(user))) {
    conditions.push(user ? { OR: [{ status: 'VERIFIED' }, { ownerId: user.id }] } : { status: 'VERIFIED' });
  }
  if (query) {
    conditions.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { documentNumber: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
      ],
    });
  }
  if (taxTopic) conditions.push({ taxTopic: { equals: taxTopic, mode: 'insensitive' } });
  if (documentType) conditions.push({ documentType: { equals: documentType, mode: 'insensitive' } });
  const where: Prisma.DocumentWhereInput = conditions.length ? { AND: conditions } : {};

  const [total, documents] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      select: {
        id: true, title: true, documentNumber: true, documentType: true,
        issuingAuthority: true, taxTopic: true, summary: true, keywords: true,
        status: true, effectiveAt: true, updatedAt: true,
        source: { select: { name: true, url: true, isOfficial: true } },
      },
      orderBy: [{ effectiveAt: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    documents,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    dataSource: 'database',
  });
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Database not configured. See docs/DB_SETUP.md' }, { status: 503 });
  const prisma = getPrisma();
  if (!prisma) return NextResponse.json({ error: 'Prisma not available' }, { status: 500 });

  const token = await getTokenFromRequest(req);
  const user = token ? await getUserBySessionToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });

  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title: body.title,
        content: body.content || null,
        documentNumber: body.documentNumber || null,
        documentType: body.documentType || null,
        issuingAuthority: body.issuingAuthority || null,
        taxTopic: body.taxTopic || null,
        summary: body.summary || null,
        keywords: Array.isArray(body.keywords) ? body.keywords.filter((item: unknown): item is string => typeof item === 'string') : [],
        effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : null,
        ownerId: user.id,
        sourceId: body.sourceId || null,
      },
    });
    await tx.documentVersion.create({
      data: { documentId: document.id, version: 1, title: document.title, content: document.content, createdById: user.id },
    });
    await tx.auditEvent.create({
      data: { action: 'CREATE_DOCUMENT', entity: 'Document', metadata: { documentId: document.id }, userId: user.id },
    });
    return document;
  });

  return NextResponse.json({ document: created }, { status: 201 });
}
