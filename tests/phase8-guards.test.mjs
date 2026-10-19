import assert from "node:assert/strict";
import test from "node:test";

test("scheduler refuses to run without a database", async () => {
  const { runSyncWorker } = await import("../scripts/sync-worker.mjs");
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  await assert.rejects(
    runSyncWorker({ trigger: "test" }),
    /DATABASE_URL is required/i,
  );
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
});

test("live crawler refuses to run without explicit source approval", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  await assert.rejects(run(process.execPath, ["scripts/crawl-legal-sources.mjs", "--live", "--max-items=1"], {
    env: { ...process.env, DATABASE_URL: "postgresql://blocked", SOURCE_ACCESS_APPROVED: "" },
  }), (error) => error.code === 1 && /SOURCE_ACCESS_APPROVED=1/i.test(`${error.stdout}${error.stderr}`));
});
