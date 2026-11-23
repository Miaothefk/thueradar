import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PDFParse } from "pdf-parse";

const args = new Set(process.argv.slice(2));
const valueFor = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const SOURCES = {
  "gdt-vietnamese": {
    key: "gdt-vietnamese-legal-documents",
    name: "Cục Thuế — Hệ thống văn bản",
    url: "https://gdt.gov.vn/wps/portal/home/documents",
    robotsUrl: "https://gdt.gov.vn/robots.txt",
    policyUrl: "https://gdt.gov.vn/wps/portal/home/documents",
    authority: "Cục Thuế",
    isVietnamese: true,
  },
  "gdt-english": {
    key: "gdt-english-legal-documents",
    name: "General Department of Taxation — Legal Documents",
    url: "https://gdt.gov.vn/wps/portal/english/documents/",
    robotsUrl: "https://gdt.gov.vn/robots.txt",
    policyUrl: "https://gdt.gov.vn/wps/portal/english/documents/",
    authority: "General Department of Taxation",
    isVietnamese: false,
  },
};
const sourceName = valueFor("source", "gdt-vietnamese");
const SOURCE = SOURCES[sourceName];
if (!SOURCE) {
  throw new Error(`Unknown source "${sourceName}". Available sources: ${Object.keys(SOURCES).join(", ")}`);
}
const dryRun = !args.has("--live");
const maxPages = Math.max(1, Number.parseInt(valueFor("max-pages", "1"), 10) || 1);
const maxItems = Math.max(1, Number.parseInt(valueFor("max-items", "20"), 10) || 20);
const delayMs = Math.max(250, Number.parseInt(valueFor("delay-ms", "1500"), 10) || 1500);
const timeoutMs = Math.max(1000, Number.parseInt(valueFor("timeout-ms", "30000"), 10) || 30000);
const retries = Math.max(0, Number.parseInt(valueFor("retries", "2"), 10) || 0);
const maxPdfBytes = Math.max(1024 * 1024, Number.parseInt(valueFor("max-pdf-bytes", "15000000"), 10) || 15000000);

const log = (event, details = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

const publicBrowserHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
  "Referer": "https://gdt.gov.vn/",
};

function fetchThroughCurl(url, binary = false, requestInit = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = typeof requestInit.body === "string"
      ? requestInit.body
      : requestInit.body instanceof URLSearchParams
        ? requestInit.body.toString()
        : "";
    const contentType = requestInit.headers?.["Content-Type"];
    const args = [
      "--location",
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "--compressed",
      "--user-agent",
      publicBrowserHeaders["User-Agent"],
      "--header",
      `Accept: ${publicBrowserHeaders.Accept}`,
      "--header",
      `Accept-Language: ${publicBrowserHeaders["Accept-Language"]}`,
      "--header",
      `Referer: ${publicBrowserHeaders.Referer}`,
      ...(requestInit.method && requestInit.method !== "GET"
        ? ["--request", requestInit.method]
        : []),
      ...(typeof requestInit.body === "string"
        ? ["--data", requestInit.body]
        : requestInit.body instanceof URLSearchParams
          ? ["--data", requestBody]
        : []),
      ...(contentType ? ["--header", `Content-Type: ${contentType}`] : []),
      url,
    ];
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`curl HTTP failure (${code}): ${Buffer.concat(stderrChunks).toString("utf8").trim()}`));
        return;
      }
      const bytes = Buffer.concat(chunks);
      resolve(binary ? bytes : bytes.toString("utf8"));
    });
  });
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
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
    const rawHref = match[1].replace(/&amp;/gi, "&");
    const url = absoluteUrl(rawHref, SOURCE.url);
    const title = stripHtml(match[2]).replace(/\s+/g, " ");
    const isVietnameseDocument = /mapping=home\/documents\/detail|\/gdt\+content\/sa_gdt\/sa_vanban\//i.test(
      decodeURIComponent(rawHref),
    );
    const isEnglishDocument = /\/detail|documents/i.test(url ?? "");
    if (!url || !title || (SOURCE.isVietnamese ? !isVietnameseDocument : !isEnglishDocument) || title.length < 12) continue;
    if (!records.some((record) => record.url === url)) records.push({ url, title });
  }
  return records;
}

function parseDetailPage(html, discovered) {
  const text = stripHtml(SOURCE.isVietnamese
    ? (html.match(/<div[^>]+id=["']contentBody["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || html.match(/<div[^>]+class=["'][^"']*panes[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || html)
    : html);
  const title = SOURCE.isVietnamese
    ? stripHtml(html.match(/<span[^>]+id=["']title["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || discovered.title || text.slice(0, 240))
    : discovered.title || text.slice(0, 240);
  const number = SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*>\s*Số\/Ký hiệu\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : title.match(/\b(?:\d+\/)?\d{1,4}\/\d{2,4}\/[A-ZĐ-]+\b/i)?.[0] ?? null;
  const type = title.match(/\b(Công văn|Thông tư|Nghị định|Quyết định|Luật|CIRCULAR|DECREE|LAW|DECISION|OFFICIAL LETTER|RESOLUTION)\b/i)?.[1] ?? null;
  const date = (SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*>\s*Ngày ban hành\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : title.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1]) || null;
  const effectiveDate = SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*id=["']effectedDate["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : null;
  const expiryDate = SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*id=["']expiredDate["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : null;
  const legalEffect = SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*id=["']legalEffect["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : null;
  const replacement = SOURCE.isVietnamese
    ? stripHtml(html.match(/<td[^>]*>\s*Thay thế văn bản\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "")
    : null;
  const attachmentUrl = SOURCE.isVietnamese
    ? absoluteUrl(
      (html.match(/<a[^>]+class=["'][^"']*linkDown[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] || "").replace(/&amp;/gi, "&"),
      discovered.url,
    )
    : null;
  const expiry = expiryDate ? new Date(expiryDate.split("/").reverse().join("-")) : null;
  const legalStatus = expiry && !Number.isNaN(expiry.getTime()) && expiry <= new Date()
    ? "EXPIRED"
    : replacement
      ? "SUPERSEDED"
      : /hết hiệu lực|bãi bỏ|không còn hiệu lực/i.test(legalEffect || "")
        ? "REPEALED"
        : /còn hiệu lực|đang có hiệu lực/i.test(legalEffect || "")
          ? "IN_FORCE"
          : "UNKNOWN";
  return {
    externalId: discovered.url,
    title: title.slice(0, 500),
    documentNumber: number,
    documentType: type,
    issuingAuthority: SOURCE.authority,
    taxTopic: "Thuế",
    content: [text, attachmentUrl ? `Tệp đính kèm chính thức: ${attachmentUrl}` : ""].filter(Boolean).join("\n\n").slice(0, 100000),
    sourceUrl: discovered.url,
    sourcePublishedAt: date ? new Date(date.split("/").reverse().join("-")).toISOString() : null,
    effectiveAt: effectiveDate ? new Date(effectiveDate.split("/").reverse().join("-")).toISOString() : null,
    expiredAt: expiryDate ? new Date(expiryDate.split("/").reverse().join("-")).toISOString() : null,
    legalStatus,
    validityCheckedAt: new Date().toISOString(),
    validityEvidenceUrl: discovered.url,
    validityMethod: legalStatus === "UNKNOWN" ? "OFFICIAL_METADATA_INSUFFICIENT" : "OFFICIAL_METADATA",
    validityEvidence: { legalEffect, replacement, expiryDate },
    attachmentUrl,
  };
}

async function fetchBinaryWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: publicBrowserHeaders,
      });
      if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
      if (contentLength > maxPdfBytes) throw new Error(`PDF exceeds ${maxPdfBytes} bytes`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > maxPdfBytes) throw new Error(`PDF exceeds ${maxPdfBytes} bytes`);
      if (!contentType.includes("pdf") && !url.toLowerCase().includes(".pdf")) {
        throw new Error(`Attachment is not a PDF (content-type: ${contentType || "unknown"})`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(500 * (2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    const bytes = await fetchThroughCurl(url, true);
    if (bytes.length > maxPdfBytes) throw new Error(`PDF exceeds ${maxPdfBytes} bytes`);
    const signature = bytes.subarray(0, 5).toString("ascii");
    if (!signature.startsWith("%PDF")) throw new Error("Attachment returned data that is not a PDF");
    return bytes;
  } catch (curlError) {
    throw curlError instanceof Error ? curlError : lastError;
  }
}

async function extractPdfText(bytes) {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text.replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
}

function conciseFallbackSummary(document) {
  const sourceText = document.pdfText || document.content || "";
  const clean = sourceText.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences?.length) {
    const summary = sentences.slice(0, 3).join(" ").trim();
    return summary.length <= 700 ? summary : `${summary.slice(0, 697)}...`;
  }
  return clean.length <= 700 ? clean : `${clean.slice(0, 697)}...`;
}

async function analyzeDocumentWithAi(document) {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT) {
    return {
      summary: conciseFallbackSummary(document),
      changeSummary: "Chưa xác định được thay đổi so với văn bản trước.",
      highlights: [],
      legalStatus: document.legalStatus,
      replacedDocumentNumber: null,
      replacementDocumentNumber: null,
      analysisMethod: "OFFICIAL_METADATA_INSUFFICIENT",
    };
  }

  const text = (document.pdfText || document.content || "").slice(0, 50000);
  const url = `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(process.env.AZURE_OPENAI_DEPLOYMENT)}/chat/completions?api-version=${encodeURIComponent(process.env.AZURE_OPENAI_API_VERSION || "2024-10-21")}`;
  const prompt = [
    "Phân tích văn bản pháp luật thuế Việt Nam chỉ dựa trên nội dung chính thức bên dưới.",
    "Trả JSON thuần với các khóa: summary, changeSummary, highlights, legalStatus, replacedDocumentNumber, replacementDocumentNumber.",
    "summary: 2-3 câu ngắn nêu nội dung chính.",
    "changeSummary: nêu thay đổi so với văn bản trước nếu có bằng chứng; nếu không có bằng chứng ghi 'Chưa xác định được thay đổi so với văn bản trước'.",
    "highlights: mảng tối đa 5 điểm nổi bật.",
    "legalStatus: IN_FORCE, EXPIRED, REPEALED, SUPERSEDED hoặc UNKNOWN.",
    "Chỉ chọn trạng thái khác UNKNOWN nếu nội dung hoặc metadata chính thức nêu rõ. Không suy đoán.",
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        temperature: 0,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `Tiêu đề: ${document.title}\nSố hiệu: ${document.documentNumber || ""}\nNội dung:\n${text}` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI analysis HTTP ${response.status}`);
    const body = await response.json();
    const raw = body?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AI analysis returned no content");
    const parsed = JSON.parse(String(raw).replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    const allowedStatuses = ["IN_FORCE", "EXPIRED", "REPEALED", "SUPERSEDED", "UNKNOWN"];
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 1200) : conciseFallbackSummary(document),
      changeSummary: typeof parsed.changeSummary === "string" ? parsed.changeSummary.trim().slice(0, 1500) : "Chưa xác định được thay đổi so với văn bản trước.",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.filter((item) => typeof item === "string").slice(0, 5) : [],
      legalStatus: allowedStatuses.includes(parsed.legalStatus) ? parsed.legalStatus : "UNKNOWN",
      replacedDocumentNumber: typeof parsed.replacedDocumentNumber === "string" ? parsed.replacedDocumentNumber : null,
      replacementDocumentNumber: typeof parsed.replacementDocumentNumber === "string" ? parsed.replacementDocumentNumber : null,
      analysisMethod: "AZURE_OPENAI_OFFICIAL_TEXT",
    };
  } catch (error) {
    log("document_analysis_fallback", { title: document.title, error: error instanceof Error ? error.message : String(error) });
    return {
      summary: conciseFallbackSummary(document),
      changeSummary: "Chưa xác định được thay đổi so với văn bản trước.",
      highlights: [],
      legalStatus: "UNKNOWN",
      replacedDocumentNumber: null,
      replacementDocumentNumber: null,
      analysisMethod: "OFFICIAL_METADATA_INSUFFICIENT",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, requestInit = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        ...requestInit,
        headers: {
          ...publicBrowserHeaders,
          ...(requestInit.headers || {}),
        },
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
  try {
    return await fetchThroughCurl(url, false, requestInit);
  } catch (curlError) {
    throw curlError instanceof Error ? curlError : lastError;
  }
}

async function fetchListPage(page) {
  if (!SOURCE.isVietnamese || page === 1) return fetchWithRetry(SOURCE.url);
  return fetchWithRetry(SOURCE.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ page: String(page), cmd: "" }),
  });
}

async function checkRobots() {
  const robots = await fetchWithRetry(SOURCE.robotsUrl);
  const groups = [];
  let current = null;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().toLowerCase();
    if (directive === "user-agent") {
      if (!current || current.hasRules) {
        current = { agents: [], disallows: [], hasRules: false };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (current && directive === "disallow") {
      current.disallows.push(value);
      current.hasRules = true;
    }
  }
  const crawlerName = "thueradarresearchbot";
  const applicable = groups.filter((group) => group.agents.includes("*") || group.agents.includes(crawlerName));
  const disallowed = applicable.some((group) => group.disallows.includes("/"));
  if (disallowed) throw new Error("Source robots.txt disallows root crawling");
  return { url: SOURCE.robotsUrl, checkedAt: new Date().toISOString(), allowedByObservedRobots: true };
}

async function main() {
  if (args.has("--help")) {
    console.log("Usage: npm run crawl:sources -- --source=gdt-vietnamese --dry-run [--max-items=20] [--max-pages=1]");
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
  log("run_started", { source: SOURCE.key, sourceName, mode: dryRun ? "dry-run" : "live", maxPages, maxItems, delayMs, timeoutMs, retries });
  const robots = await checkRobots();
  log("robots_checked", robots);

  const discovered = [];
  for (let page = 1; page <= maxPages && discovered.length < maxItems; page += 1) {
    const html = await fetchListPage(page);
    let pageCount = 0;
    for (const record of parseListPage(html)) {
      if (!discovered.some((item) => item.url === record.url)) {
        discovered.push(record);
        pageCount += 1;
      }
      if (discovered.length >= maxItems) break;
    }
    log("page_fetched", { page, discovered: pageCount });
    if (page < maxPages) await sleep(delayMs);
  }
  log("items_discovered", { count: discovered.length });

  const items = [];
  for (const record of discovered) {
    try {
      await sleep(delayMs);
      const document = parseDetailPage(await fetchWithRetry(record.url), record);
      if (document.attachmentUrl) {
        const pdfBytes = await fetchBinaryWithRetry(document.attachmentUrl);
        document.pdfChecksum = sha256Buffer(pdfBytes);
        document.pdfText = await extractPdfText(pdfBytes);
        document.content = [
          document.content,
          document.pdfText || "Không trích xuất được lớp văn bản từ PDF; cần OCR để đọc bản scan.",
        ].filter(Boolean).join("\n\n").slice(0, 100000);
        document.contentExtraction = document.pdfText ? "TEXT_EXTRACTED" : "NO_TEXT_LAYER";
      } else {
        document.contentExtraction = "NO_ATTACHMENT";
      }
      document.checksum = sha256(JSON.stringify({
        title: document.title,
        content: document.content,
        documentNumber: document.documentNumber,
        pdfChecksum: document.pdfChecksum,
      }));
      const analysis = await analyzeDocumentWithAi(document);
      document.summary = analysis.summary;
      document.changeSummary = analysis.changeSummary;
      document.highlights = analysis.highlights;
      document.legalStatus = analysis.legalStatus;
      document.replacedDocumentNumber = analysis.replacedDocumentNumber;
      document.replacementDocumentNumber = analysis.replacementDocumentNumber;
      document.analysisMethod = analysis.analysisMethod;
      document.analysisCheckedAt = new Date().toISOString();
      items.push(document);
      log("item_fetched", {
        externalId: document.externalId,
        title: document.title,
        documentNumber: document.documentNumber,
        attachmentUrl: document.attachmentUrl,
        contentExtraction: document.contentExtraction,
        legalStatus: document.legalStatus,
        validityMethod: document.validityMethod,
        pdfChecksum: document.pdfChecksum,
        checksum: document.checksum,
      });
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
      create: {
        name: SOURCE.name,
        url: SOURCE.url,
        robotsUrl: SOURCE.robotsUrl,
        accessPolicyUrl: SOURCE.policyUrl,
        adapterKey: SOURCE.key,
        isOfficial: true,
        verifiedAt: new Date(),
      },
      update: { name: SOURCE.name, url: SOURCE.url, robotsUrl: SOURCE.robotsUrl, accessPolicyUrl: SOURCE.policyUrl },
    });
    const run = await prisma.ingestionRun.create({
      data: { sourceId: source.id, adapterKey: SOURCE.key, mode: "live", status: "RUNNING", discovered: discovered.length, fetched: items.length },
    });
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of items) {
      const existing = await prisma.document.findUnique({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        select: { id: true, checksum: true, validityCheckedAt: true, summary: true, analysisCheckedAt: true },
      });
      if (existing?.checksum === item.checksum && existing.validityCheckedAt && existing.summary && existing.analysisCheckedAt) {
        skipped += 1;
        continue;
      }
      await prisma.document.upsert({
        where: { sourceId_externalId: { sourceId: source.id, externalId: item.externalId } },
        create: {
          title: item.title, content: item.content, documentNumber: item.documentNumber,
          documentType: item.documentType, issuingAuthority: item.issuingAuthority, taxTopic: item.taxTopic,
          summary: item.summary,
          highlights: item.highlights || [],
          changeSummary: item.changeSummary,
          replacedDocumentNumber: item.replacedDocumentNumber,
          replacementDocumentNumber: item.replacementDocumentNumber,
          analysisMethod: item.analysisMethod,
          analysisCheckedAt: item.analysisCheckedAt ? new Date(item.analysisCheckedAt) : null,
          effectiveAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
          legalStatus: item.legalStatus,
          validityCheckedAt: new Date(item.validityCheckedAt),
          validityEvidenceUrl: item.validityEvidenceUrl,
          validityMethod: item.validityMethod,
          sourceUpdatedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
          externalId: item.externalId, checksum: item.checksum, sourceId: source.id, status: "VERIFIED",
        },
        update: {
          title: item.title,
          content: item.content,
          checksum: item.checksum,
          summary: item.summary,
          highlights: item.highlights || [],
          changeSummary: item.changeSummary,
          replacedDocumentNumber: item.replacedDocumentNumber,
          replacementDocumentNumber: item.replacementDocumentNumber,
          analysisMethod: item.analysisMethod,
          analysisCheckedAt: item.analysisCheckedAt ? new Date(item.analysisCheckedAt) : null,
          legalStatus: item.legalStatus,
          validityCheckedAt: new Date(item.validityCheckedAt),
          validityEvidenceUrl: item.validityEvidenceUrl,
          validityMethod: item.validityMethod,
          sourceUpdatedAt: item.sourcePublishedAt ? new Date(item.sourcePublishedAt) : null,
          status: "VERIFIED",
        },
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
          metadata: {
            checksum: item.checksum,
            pdfChecksum: item.pdfChecksum,
            sourceUrl: item.sourceUrl,
            attachmentUrl: item.attachmentUrl,
            contentExtraction: item.contentExtraction,
            legalStatus: item.legalStatus,
            validityMethod: item.validityMethod,
            validityEvidence: item.validityEvidence,
            adapterKey: SOURCE.key,
          },
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
