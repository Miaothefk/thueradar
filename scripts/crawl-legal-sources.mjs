import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SOURCE = {
  key: "gdt-english-legal-documents",
  name: "General Department of Taxation — Legal Documents",
  url: "https://gdt.gov.vn/wps/portal/english/documents/",
  robotsUrl: "https://gdt.gov.vn/robots.txt",
  policyUrl: "https://gdt.gov.vn/wps/portal/english/documents/",
};

const args = new Set(process.argv.slice(2));
const valueFor = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const dryRun = !args.has("--live");
const maxPages = Math.max(1, Number.parseInt(valueFor("max-pages", "1"), 10) || 1);
const maxItems = Math.max(1, Number.parseInt(valueFor("max-items", "20"), 10) || 20);
const delayMs = Math.max(250, Number.parseInt(valueFor("delay-ms", "1500"), 10) || 1500);
const timeoutMs = Math.max(1000, Number.parseInt(valueFor("timeout-ms", "10000"), 10) || 10000);
const retries = Math.max(0, Number.parseInt(valueFor("retries", "2"), 10) || 0);

const log = (event, details = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === "https:" && url.hostname === new URL(SOURCE.url).hostname ? url.href : null;
  } catch {
    return null;
  }
}

function parseListPage(html) {
  const records = [];
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const url = absoluteUrl(match[1], SOURCE.url);
    const title = stripHtml(match[2]);
    if (!url || !title || !/\/detail|documents/i.test(url) || title.length < 12) continue;
    if (!records.some((record) => record.url === url)) records.push({ url, title });
  }
  return records;
}

function parseDetailPage(html, discovered) {
  const text = stripHtml(html);
  const title = discovered.title || text.slice(0, 240);
  const number = title.match(/\b(?:\d+\/)?\d{1,4}\/\d{2,4}\/[A-ZĐ-]+\b/i)?.[0] ?? null;
  const type = title.match(/\b(CIRCULAR|DECREE|LAW|DECISION|OFFICIAL LETTER|RESOLUTION)\b/i)?.[1] ?? null;
  const date = title.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1] ?? null;
  return {
    externalId: discovered.url,
    title: title.slice(0, 500),
    documentNumber: number,
    documentType: type,
    issuingAuthority: "General Department of Taxation",
    taxTopic: "Thuế",
    content: text.slice(0, 100000),
    sourceUrl: discovered.url,
    sourcePublishedAt: date ? new Date(date.split("/").reverse().join("-")).toISOString() : null,
  };
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ThueRadarResearchBot/0.1 (+legal-source-review)" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(500 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function checkRobots() {
  const robots = await fetchWithRetry(SOURCE.robotsUrl);
  const disallowed = robots.split(/\r?\n/).some((line) => /^disallow:\s*\/\s*$/i.test(line.trim()));
  if (disallowed) throw new Error("Source robots.txt disallows root crawling");
  return { url: SOURCE.robotsUrl, checkedAt: new Date().toISOString(), allowedByObservedRobots: true };
}

async function main() {
  if (args.has("--help")) {
    console.log("Usage: npm run crawl:sources -- --dry-run [--max-items=20] [--max-pages=1]");
    console.log("Live mode requires --live, DATABASE_URL, and SOURCE_ACCESS_APPROVED=1.");
    return;
  }
  if (!dryRun && process.env.SOURCE_ACCESS_APPROVED !== "1") {
    throw new Error("Live ingestion is blocked. Set SOURCE_ACCESS_APPROVED=1 only after human source-access review.");
  }
  if (!dryRun && !process.env.DATABASE_URL) {
    throw new Error("Live ingestion requires DATABASE_URL. No database operation was attempted.");
  }

  const startedAt = new Date();
  log("run_started", { source: SOURCE.key, mode: dryRun ? "dry-run" : "live", maxPages, maxItems, delayMs, timeoutMs, retries });
  const robots = await checkRobots();
  log("robots_checked", robots);

  const discovered = [];
  for (let page = 1; page <= maxPages && discovered.length < maxItems; page += 1) {
    const html = await fetchWithRetry(SOURCE.url);
    for (const record of parseListPage(html)) {
      if (!discovered.some((item) => item.url === record.url)) discovered.push(record);
      if (discovered.length >= maxItems) break;
    }
    if (page < maxPages) await sleep(delayMs);
  }
  log("items_discovered", { count: discovered.length });

  const items = [];
  for (const record of discovered) {
    try {
      await sleep(delayMs);
      const document = parseDetailPage(await fetchWithRetry(record.url), record);
      document.checksum = sha256(JSON.stringify({
        title: document.title,
        content: document.content,
        documentNumber: document.documentNumber,
      }));
      items.push(document);
      log("item_fetched", { externalId: document.externalId, checksum: document.checksum });
    } catch (error) {
      log("item_failed", { externalId: record.url, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (dryRun) {
    log("dry_run_complete", {
      source: SOURCE.key,
      fetched: items.length,
      note: "No database writes were performed; this output is not an ingestion claim.",
    });
    return;
  }

  const prisma = new PrismaClient();
  try {
    const source = await prisma.source.upsert({
      where: { adapterKey: SOURCE.key },
      create: { ...SOURCE, adapterKey: SOURCE.key, isOfficial: true, verifiedAt: new Date() },
      update: { name: SOURCE.name, url: SOURCE.url, robotsUrl: SOURCE.robotsUrl, accessPolicyUrl: SOURCE.policyUrl },
    });
    const run = await prisma.ingestionRun.create({
      data: { sourceId: source.id, adapterKey: SOURCE.key, mode: "live", status: "RUNNING", discovered: discovered.length, fetched: items.length },
    });
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const existing = await prisma.document.findUnique({ where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } } });
      if (existing?.checksum === item.checksum) {
        skipped += 1;
        continue;
      }
      await prisma.document.upsert({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        create: {
          title: item.title, content: item.content, documentNumber: item.documentNumber,
          documentType: item.documentType, issuingAuthority: item.issuingAuthority, taxTopic: item.taxTopic,
          effectiveAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
          sourceUpdatedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
          externalId: item.externalId, checksum: item.checksum, sourceId: source.id, status: "DRAFT",
        },
        update: { title: item.title, content: item.content, checksum: item.checksum, sourceUpdatedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null },
      });
      const document = await prisma.document.findUniqueOrThrow({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        select: { id: true },
      });
      const versionCount = await prisma.documentVersion.count({ where: { documentId: document.id } });
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          version: versionCount + 1,
          title: item.title,
          content: item.content,
          metadata: { checksum: item.checksum, sourceUrl: item.sourceUrl, adapterKey: SOURCE.key },
        },
      });
      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "COMPLETED", finishedAt: new Date(), created, updated, skipped, log: { robots, source: SOURCE } } });
    log("live_complete", { runId: run.id, created, updated, skipped, source: SOURCE.key });
  } finally {
    await prisma.$disconnect();
  }
  log("run_finished", { durationMs: Date.now() - startedAt.getTime() });
}

main().catch((error) => {
  log("run_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
