import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const LOCK_KEY = 874231;
const TIME_ZONE = process.env.SYNC_TIMEZONE || "Asia/Ho_Chi_Minh";
const SCHEDULE_HOUR = Number.parseInt(process.env.SYNC_SCHEDULE_HOUR || "2", 10);
const maxRetries = Math.max(1, Number.parseInt(process.env.SYNC_MAX_RETRIES || "3", 10) || 3);
const retryDelayMs = Math.max(1000, Number.parseInt(process.env.SYNC_RETRY_DELAY_MS || "5000", 10) || 5000);
const maxItems = Math.max(1, Number.parseInt(process.env.SYNC_MAX_ITEMS || "20", 10) || 20);
const crawlerTimeoutMs = Math.max(1000, Number.parseInt(process.env.CRAWLER_TIMEOUT_MS || "60000", 10) || 60000);
const crawlerRetries = Math.max(0, Number.parseInt(process.env.CRAWLER_RETRIES || "2", 10) || 2);
const isScheduled = process.argv.includes("--scheduled");
const isManual = process.argv.includes("--manual");
const force = process.argv.includes("--force");

function log(event, details = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...details }));
}

function localDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(date)) };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCrawler() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "scripts/crawl-legal-sources.mjs",
      "--live",
      `--max-items=${maxItems}`,
      `--timeout-ms=${crawlerTimeoutMs}`,
      `--retries=${crawlerRetries}`,
    ], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Crawler exited with code ${code}: ${stderr || stdout}`)));
  });
}

export async function runSyncWorker({ trigger = isManual ? "manual" : "scheduled", force = false } = {}) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required; scheduler was not started.");
  if (isScheduled && !force) {
    const parts = localDateParts();
    if (parts.hour !== SCHEDULE_HOUR) {
      return { status: "SKIPPED_OUTSIDE_WINDOW", timezone: TIME_ZONE, localDate: parts.date, localHour: parts.hour, scheduleHour: SCHEDULE_HOUR };
    }
  }

  const prisma = new PrismaClient();
  const runKey = `daily:${localDateParts().date}`;
  let locked = false;
  let run;
  try {
    const lockResult = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`;
    locked = Boolean(lockResult[0]?.locked);
    if (!locked) return { status: "ALREADY_RUNNING", runKey };

    const existing = await prisma.schedulerRun.findUnique({ where: { runKey } });
    if (existing?.status === "COMPLETED" && !force) return { status: "ALREADY_COMPLETED", runKey, runId: existing.id };
    if (existing?.status === "RUNNING") return { status: "ALREADY_RUNNING", runKey, runId: existing.id };
    run = existing
      ? await prisma.schedulerRun.update({
        where: { id: existing.id },
        data: { trigger, status: "RUNNING", attempt: 0, startedAt: new Date(), finishedAt: null, error: null, metadata: { timezone: TIME_ZONE, scheduleHour: SCHEDULE_HOUR, maxItems } },
      })
      : await prisma.schedulerRun.create({
        data: { runKey, trigger, status: "RUNNING", metadata: { timezone: TIME_ZONE, scheduleHour: SCHEDULE_HOUR, maxItems } },
      });
    log("sync_started", { runId: run.id, runKey, trigger, timezone: TIME_ZONE });

    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const result = await runCrawler();
        await prisma.schedulerRun.update({ where: { id: run.id }, data: { status: "COMPLETED", attempt, finishedAt: new Date(), metadata: { timezone: TIME_ZONE, crawlerOutput: result.stdout.slice(-4000) } } });
        log("sync_completed", { runId: run.id, attempt });
        return { status: "COMPLETED", runId: run.id, attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        log("sync_attempt_failed", { runId: run.id, attempt, error: lastError });
        if (attempt < maxRetries) await sleep(retryDelayMs * attempt);
      }
    }
    await prisma.schedulerRun.update({ where: { id: run.id }, data: { status: "FAILED", attempt: maxRetries, finishedAt: new Date(), error: lastError } });
    throw new Error(lastError || "Synchronization failed.");
  } catch (error) {
    if (run) {
      await prisma.schedulerRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) } }).catch(() => {});
    }
    throw error;
  } finally {
    if (locked) await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`;
    await prisma.$disconnect();
  }
}

// Nhận diện CLI tương thích hoàn toàn trên Windows
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runSyncWorker({ force })
    .then((result) => {
      log("worker_finished", result);
      process.exitCode = result.status?.startsWith("SKIPPED") || result.status?.startsWith("ALREADY") || result.status === "COMPLETED" ? 0 : 1;
    })
    .catch((error) => {
      const errMsg = error instanceof Error ? error.message : String(error);
      // Ghi log lỗi ra stderr theo đúng yêu cầu
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), event: "worker_failed", error: errMsg }));
      process.exitCode = 1;
    });
}