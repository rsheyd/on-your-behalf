import test from "node:test";
import assert from "node:assert/strict";
import { isSensitiveField, uniqueSuggestions } from "../src/form-core.js";

test("identifies password, payment, and authentication-code fields", () => {
  assert.equal(isSensitiveField({ type: "password", label: "Choose anything" }), true);
  assert.equal(isSensitiveField({ type: "text", autocomplete: "cc-number" }), true);
  assert.equal(isSensitiveField({ type: "text", label: "Verification code" }), true);
  assert.equal(isSensitiveField({ type: "email", label: "Email address" }), false);
});

test("deduplicates and rejects malformed suggestions", () => {
  assert.deepEqual(uniqueSuggestions([
    { fieldId: "a", value: "first" },
    { fieldId: "a", value: "second" },
    { fieldId: "b", value: true },
    { fieldId: "", value: "bad" },
    { fieldId: "c", value: null }
  ]), [
    { fieldId: "a", value: "first", basis: "supported" },
    { fieldId: "b", value: true, basis: "supported" }
  ]);
});

test("keeps recognized answer bases and defaults unknown ones", () => {
  assert.deepEqual(uniqueSuggestions([
    { fieldId: "a", value: "yes", basis: "chosen" },
    { fieldId: "b", value: "no", basis: "inferred" },
    { fieldId: "c", value: "value", basis: "invented" }
  ]), [
    { fieldId: "a", value: "yes", basis: "chosen" },
    { fieldId: "b", value: "no", basis: "inferred" },
    { fieldId: "c", value: "value", basis: "supported" }
  ]);
});

test("removes basis metadata accidentally appended to answer text", () => {
  assert.deepEqual(uniqueSuggestions([
    { fieldId: "a", value: "Datadog experience (Supported)", basis: "supported" },
    { fieldId: "b", value: "Likely no (inferred)", basis: "inferred" }
  ]), [
    { fieldId: "a", value: "Datadog experience", basis: "supported" },
    { fieldId: "b", value: "Likely no", basis: "inferred" }
  ]);
});
