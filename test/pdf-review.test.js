import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { approvePdfFields } from "../bin/pdf-review.js";

const pdf = Buffer.from("synthetic PDF bytes");
const hash = createHash("sha256").update(pdf).digest("hex");
const placement = { page: 1, pdfRect: [10, 20, 100, 40] };
const inventory = { fields: [{ fieldId: "first", type: "text", placements: [placement] }] };
const review = { format: "oyb-field-review", version: 1, pdfSha256: hash, fields: [{ fieldId: "first", type: "text", ...placement, label: "First name", reviewStatus: "unreviewed" }] };

function dependencies(candidate = review, current = inventory) {
  let written;
  return {
    read: async path => path === "input.pdf" ? pdf : JSON.stringify(candidate),
    inspect: async () => current,
    exists: async () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
    write: async (path, contents) => { written = { path, map: JSON.parse(contents) }; },
    written: () => written
  };
}

test("approval exports only explicitly selected reviewed text fields", async () => {
  const deps = dependencies();
  const result = await approvePdfFields({ inputPath: "input.pdf", reviewPath: "review.json", selectedIds: "first", outputPath: "approved.json" }, deps);
  assert.equal(result.approved, 1);
  assert.equal(deps.written().map.fields[0].reviewStatus, "approved");
  assert.equal(deps.written().map.fields[0].label, "First name");
});

test("approval rejects stale, moved, unlabeled, and sensitive fields", async () => {
  const request = { inputPath: "input.pdf", reviewPath: "review.json", selectedIds: "first", outputPath: "approved.json" };
  await assert.rejects(approvePdfFields(request, dependencies({ ...review, pdfSha256: "stale" })), /does not match/);
  await assert.rejects(approvePdfFields(request, dependencies(review, { fields: [{ fieldId: "first", type: "text", placements: [{ page: 2, pdfRect: placement.pdfRect }] }] })), /moved/);
  await assert.rejects(approvePdfFields(request, dependencies({ ...review, fields: [{ ...review.fields[0], label: "" }] })), /reviewed label/);
  await assert.rejects(approvePdfFields(request, dependencies({ ...review, fields: [{ ...review.fields[0], label: "Signature" }] })), /requires user entry/);
});
