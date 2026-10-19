import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

test("database-backed document flow fails explicitly when database is not configured", async () => {
  const list = await json("/api/documents");
  assert.equal(list.response.status, 503);
  assert.match(list.body.error, /database/i);

  const create = await json("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: `phase8-${Date.now()}` }),
  });
  assert.equal(create.response.status, 503);
  assert.match(create.body.error, /database/i);
});

test("protected Phase 7 endpoints do not claim persistence without infrastructure", async () => {
  const saved = await json("/api/saved-documents");
  assert.equal(saved.response.status, 503);
  const notifications = await json("/api/notifications");
  assert.equal(notifications.response.status, 503);
  const feedback = await json("/api/ai/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answerId: "missing", kind: "RATING", rating: 5 }),
  });
  assert.equal(feedback.response.status, 503);
});
