import test from "node:test";
import assert from "node:assert/strict";
import {
  enabledSupportingDocuments,
  MAX_SUPPORTING_DOCUMENT_CHARS,
  MAX_SUPPORTING_DOCUMENTS,
  normalizeSupportingDocuments,
  validateSupportingDocuments
} from "../src/supporting-documents.js";

const validDocument = {
  id: "doc-1",
  name: "linkedin-profile.md",
  type: "md",
  importedAt: "2026-09-02T20:00:00.000Z",
  enabled: true,
  text: "# Professional profile"
};

test("normalizes stored supporting documents and rejects malformed entries", () => {
  assert.deepEqual(normalizeSupportingDocuments([
    validDocument,
    { ...validDocument },
    { id: "doc-2", name: "notes\nrenamed.txt", text: " Notes ", enabled: false },
    { id: "doc-3", name: "empty.txt", text: "" }
  ]), [
    validDocument,
    { id: "doc-2", name: "notes renamed.txt", type: "", importedAt: "", enabled: false, text: "Notes" }
  ]);
});

test("returns only enabled supporting documents", () => {
  assert.deepEqual(enabledSupportingDocuments([
    validDocument,
    { ...validDocument, id: "doc-2", name: "disabled.md", enabled: false }
  ]), [validDocument]);
});

test("validates supporting document count and combined size", () => {
  const tooMany = Array.from({ length: MAX_SUPPORTING_DOCUMENTS + 1 }, (_, index) => ({
    ...validDocument,
    id: `doc-${index}`,
    name: `${index}.md`
  }));
  assert.throws(() => validateSupportingDocuments(tooMany), /no more than 10/i);
  assert.throws(() => validateSupportingDocuments([{ ...validDocument, text: "x".repeat(MAX_SUPPORTING_DOCUMENT_CHARS + 1) }]), /combined text under 200,000/i);
});
