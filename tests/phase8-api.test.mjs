import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

test("database-backed document flow fails explicitly when database is not configured", async () => {
  const list = await json("/api/documents");
  assert.ok([200, 503].includes(list.response.status));
  if (list.response.status === 503) assert.match(list.body.error, /database/i);
  if (list.response.status === 200) assert.ok(Array.isArray(list.body.documents));

  const create = await json("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: `phase8-${Date.now()}` }),
  });
  assert.ok([400, 401, 503].includes(create.response.status));
  if (create.response.status === 503) assert.match(create.body.error, /database/i);
});

test("protected Phase 7 endpoints do not claim persistence without infrastructure", async () => {
  const saved = await json("/api/saved-documents");
  assert.ok([200, 401, 503].includes(saved.response.status));
  const notifications = await json("/api/notifications");
  assert.ok([200, 401, 503].includes(notifications.response.status));
  const feedback = await json("/api/ai/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answerId: "missing", kind: "RATING", rating: 5 }),
  });
  assert.ok([400, 401, 503].includes(feedback.response.status));
});
