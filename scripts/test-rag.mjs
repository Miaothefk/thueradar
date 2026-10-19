import assert from "node:assert/strict";
import test from "node:test";
import { buildNoEvidenceResponse, validateCitations } from "../src/lib/ai/citation-policy.mjs";
import { AiProviderError, createAiProvider } from "../src/lib/ai/provider.mjs";

test("accepts citations that exist in the retrieved source set", () => {
  const result = validateCitations("Theo văn bản [D1], quy định được áp dụng.", [{ id: "D1" }]);
  assert.equal(result.isValid, true);
  assert.deepEqual(result.invalidIds, []);
});

test("rejects citations that were not retrieved", () => {
  const result = validateCitations("Kết luận này dựa trên [D9].", [{ id: "D1" }]);
  assert.equal(result.isValid, false);
  assert.deepEqual(result.invalidIds, ["D9"]);
});

test("returns an explicit no-evidence response", () => {
  const result = buildNoEvidenceResponse();
  assert.equal(result.status, "NO_EVIDENCE");
  assert.equal(result.citations.length, 0);
  assert.match(result.answer, /Chưa thể trả lời/);
});

test("reports provider HTTP failures without exposing the API key", async () => {
  const provider = createAiProvider({ OPENAI_API_KEY: "secret-key", OPENAI_MODEL: "test-model" }, async () => ({
    ok: false,
    status: 429,
    json: async () => ({}),
  }));
  await assert.rejects(
    provider.generateAnswer({ question: "q", sources: [{ id: "D1", title: "t", content: "c" }] }),
    (error) => error instanceof AiProviderError && error.code === "PROVIDER_HTTP_ERROR" && !error.message.includes("secret-key"),
  );
});
