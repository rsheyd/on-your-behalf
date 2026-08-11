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
    { fieldId: "a", value: "first" },
    { fieldId: "b", value: true }
  ]);
});
