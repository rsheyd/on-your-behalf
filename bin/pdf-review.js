import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { inspectPdf } from "./pdf-inspect.js";
import { validateReviewedMap } from "./pdf-fill.js";

const execute = promisify(execFile);
const REVIEWER = fileURLToPath(new URL("../scripts/review-pdf-fields.py", import.meta.url));

export async function createPdfReview(inputPath, directory, { python = process.env.OYB_PYTHON || "python3", exec = execute } = {}) {
  let stdout;
  try { ({ stdout } = await exec(python, [REVIEWER, inputPath, directory], { maxBuffer: 4_000_000 })); }
  catch (error) { throw new Error(error.stderr?.trim() || "Could not create a PDF review. Check pdfplumber, Pillow, Tesseract, and Poppler."); }
  return JSON.parse(stdout);
}

export async function approvePdfFields({ inputPath, reviewPath, selectedIds, outputPath }, { read = readFile, inspect = inspectPdf, exists = access, write = writeFile } = {}) {
  const ids = selectedIds.split(",").map(value => value.trim());
  if (!ids.length || ids.some(value => !value) || new Set(ids).size !== ids.length) throw new Error("Choose distinct field IDs with --fields id1,id2.");
  try { await exists(outputPath); throw new Error("The reviewed map already exists. Choose a new output path."); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const [pdf, reviewText, inventory] = await Promise.all([read(inputPath), read(reviewPath, "utf8"), inspect(inputPath)]);
  let review;
  try { review = JSON.parse(reviewText); } catch { throw new Error("The PDF review is not valid JSON."); }
  const hash = createHash("sha256").update(pdf).digest("hex");
  if (review?.format !== "oyb-field-review" || review.version !== 1 || review.pdfSha256 !== hash || !Array.isArray(review.fields)) throw new Error("The review does not match this PDF.");
  const byId = new Map();
  for (const field of review.fields) {
    if (!field || typeof field.fieldId !== "string" || !field.fieldId) throw new Error("The review has an invalid field ID.");
    byId.set(field.fieldId, [...(byId.get(field.fieldId) || []), field]);
  }
  const current = new Map(inventory.fields.map(field => [field.fieldId, field]));
  const selected = ids.map(id => {
    const reviewed = byId.get(id) || [];
    const field = reviewed[0];
    const canonical = current.get(id);
    if (reviewed.length !== 1 || !canonical || canonical.type !== "text" || canonical.placements.length !== 1 || field.type !== "text") throw new Error(`Field ${id} is missing, ambiguous, or not a text field.`);
    const placement = canonical.placements[0];
    if (field.page !== placement.page || JSON.stringify(field.pdfRect) !== JSON.stringify(placement.pdfRect)) throw new Error(`Field ${id} moved since this review was made.`);
    if (!String(field.label || "").trim()) throw new Error(`Give field ${id} a reviewed label before approving it.`);
    return { fieldId: id, kind: "input", inputType: "text", label: field.label.trim(), page: field.page, pdfRect: field.pdfRect, reviewStatus: "approved" };
  });
  const map = { pdfSha256: hash, page: { title: basename(inputPath) }, fields: selected };
  validateReviewedMap(map, hash);
  await write(outputPath, `${JSON.stringify(map, null, 2)}\n`, { flag: "wx" });
  return { output: outputPath, approved: selected.length, fieldIds: ids };
}
