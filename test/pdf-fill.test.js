import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { runPdfFill, validateReviewedMap } from "../bin/pdf-fill.js";

const input = Buffer.from("synthetic PDF bytes");
const hash = createHash("sha256").update(input).digest("hex");
const fields = [
  { fieldId: "first", label: "First name", kind: "input", inputType: "text", page: 1, pdfRect: [10, 10, 100, 30], reviewStatus: "approved" },
  { fieldId: "middle", label: "Middle name", kind: "input", inputType: "text", page: 1, pdfRect: [110, 10, 200, 30], reviewStatus: "approved" }
];
const map = { pdfSha256: hash, page: { title: "Synthetic form" }, fields };

test("reviewed PDF map requires the exact source and excludes user-only fields", () => {
  assert.equal(validateReviewedMap(map, hash).fields.length, 2);
  assert.throws(() => validateReviewedMap(map, "different"), /does not match/);
  assert.throws(() => validateReviewedMap({ ...map, fields: [{ ...fields[0], reviewStatus: "unreviewed" }] }, hash), /approved/);
  assert.throws(() => validateReviewedMap({ ...map, fields: [{ ...fields[0], label: "Signature" }] }, hash), /requires user entry/);
});

test("PDF fill sends only approved fields to OYB and writes only supported suggestions", async () => {
  let analyzed;
  let written;
  const result = await runPdfFill({ inputPath: "prepared.pdf", outputPath: "filled.pdf", mapPath: "reviewed.json", profilePath: "profile.txt", provider: "openai", apiKey: "test-key" }, {
    read: async path => path === "prepared.pdf" ? input : path === "reviewed.json" ? JSON.stringify(map) : "Synthetic Person",
    fileExists: async () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
    analyze: async payload => { analyzed = payload; return { suggestions: [{ fieldId: "first", value: "Synthetic" }, { fieldId: "unknown", value: "discard" }], unresolved: [{ fieldId: "middle", reason: "missing_profile_info" }] }; },
    writer: async payload => { written = payload; return { filled: 1, fieldIds: ["first"] }; }
  });
  assert.deepEqual(analyzed.fields, fields);
  assert.equal(analyzed.answeringPosture, "leave_uncertain_open");
  assert.deepEqual(written.values, { first: "Synthetic" });
  assert.equal(result.filled, 1);
  assert.equal(result.unresolved[0].fieldId, "middle");
});
