import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeForm } from "../src/answer-engine.js";
import { isSensitiveField } from "../src/form-core.js";

const WRITER = fileURLToPath(new URL("../scripts/write-pdf-fields.py", import.meta.url));
const USER_ONLY_FIELD = /\b(?:social security|ssn|signature|consent|authorization|criminal|background check|fingerprint|attestation)\b/i;

export function validateReviewedMap(map, pdfHash) {
  if (!map || map.pdfSha256 !== pdfHash || !map.page || !Array.isArray(map.fields) || !map.fields.length) throw new Error("The reviewed field map does not match this PDF or has no fields.");
  const ids = new Set();
  for (const field of map.fields) {
    if (!field || typeof field.fieldId !== "string" || !field.fieldId || ids.has(field.fieldId) || typeof field.label !== "string" || !field.label.trim() || field.reviewStatus !== "approved" || field.kind !== "input" || !Number.isInteger(field.page) || field.page < 1 || !Array.isArray(field.pdfRect) || field.pdfRect.length !== 4 || field.pdfRect.some(value => !Number.isFinite(value))) throw new Error("Every mapped field needs a unique ID, label, page, rectangle, and approved input status.");
    if (isSensitiveField({ ...field, type: field.inputType }) || USER_ONLY_FIELD.test(field.label)) throw new Error(`Field ${field.fieldId} requires user entry and cannot be filled by this CLI preview.`);
    ids.add(field.fieldId);
  }
  return { page: map.page, fields: map.fields };
}

export async function writePdfFields({ inputPath, outputPath, values }, { python = process.env.OYB_PYTHON || "python3", spawnProcess = spawn } = {}) {
  const child = spawnProcess(python, [WRITER, inputPath, outputPath], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  child.stdin.end(JSON.stringify({ values }));
  const code = await new Promise((resolveExit, reject) => { child.on("error", reject); child.on("close", resolveExit); });
  if (code !== 0) throw new Error(`PDF writer failed: ${stderr.trim() || `exit ${code}`}`);
  return JSON.parse(stdout);
}

export async function runPdfFill({ inputPath, outputPath, mapPath, profilePath, profile: suppliedProfile = "", supportingDocuments = [], provider, apiKey, model = "" }, { read = readFile, fileExists = access, analyze = analyzeForm, writer = writePdfFields } = {}) {
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("Choose an output path different from the input PDF.");
  try { await fileExists(outputPath); throw new Error("The output PDF already exists. Choose a new path."); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const [pdfBytes, mapText, profile] = await Promise.all([read(inputPath), read(mapPath, "utf8"), profilePath ? read(profilePath, "utf8") : suppliedProfile]);
  let map;
  try { map = JSON.parse(mapText); } catch { throw new Error("The reviewed field map is not valid JSON."); }
  const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");
  const { page, fields } = validateReviewedMap(map, pdfHash);
  const analysis = await analyze({ profile, supportingDocuments, provider, apiKey, model, page, fields, answeringPosture: "leave_uncertain_open" });
  const allowed = new Set(fields.map(field => field.fieldId));
  const values = Object.fromEntries((analysis.suggestions || []).filter(item => allowed.has(item.fieldId) && typeof item.value === "string" && item.value.trim()).map(item => [item.fieldId, item.value]));
  if (!Object.keys(values).length) throw new Error("OYB found no supported answers to write; the input PDF was unchanged.");
  const written = await writer({ inputPath, outputPath, values });
  return { output: outputPath, filled: written.filled, fieldIds: written.fieldIds, unresolved: analysis.unresolved || [], message: "Review the filled PDF visually before using it." };
}
