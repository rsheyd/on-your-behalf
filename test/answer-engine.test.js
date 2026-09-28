import test from "node:test";
import assert from "node:assert/strict";
import { analyzeForm } from "../src/answer-engine.js";

test("shared answer engine builds a grounded prompt and validates provider suggestions", async () => {
  const fields = [{ fieldId: "name", kind: "input", label: "Full name" }];
  let sent;
  const result = await analyzeForm({
    profile: "My name is Example Person.", provider: "openai", apiKey: "test-key", page: { title: "Sample form" }, fields,
    request: async (_url, options) => {
      sent = options;
      return { ok: true, text: async () => JSON.stringify({ output_text: JSON.stringify({ suggestions: [{ fieldId: "name", value: "Example Person" }, { fieldId: "unknown", value: "Ignore" }], unresolved: [] }) }) };
    }
  });
  assert.match(JSON.parse(sent.body).input, /My name is Example Person/);
  assert.equal(sent.headers.authorization, "Bearer test-key");
  assert.deepEqual(result.suggestions, [{ fieldId: "name", value: "Example Person", basis: "supported" }]);
});

test("shared answer engine rejects a request without user-provided facts", async () => {
  await assert.rejects(() => analyzeForm({ profile: "  ", fields: [] }), /Include your saved profile/);
});
