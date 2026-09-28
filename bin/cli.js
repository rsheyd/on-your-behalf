import { readFile } from "node:fs/promises";
import { analyzeForm } from "../src/answer-engine.js";
import { isSensitiveField } from "../src/form-core.js";
import { runPdfFill } from "./pdf-fill.js";

const KEY_VARIABLES = Object.freeze({ openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" });
const HELP = `On Your Behalf CLI (early preview)

Usage:
  oyb suggest --profile profile.txt --fields form.json --provider openai|anthropic|gemini [--model model]
  oyb fill prepared.pdf --field-map reviewed.json --profile profile.txt --provider openai|anthropic|gemini --output filled.pdf [--model model]

The suggest command prints validated answer suggestions as JSON. It does not fill a form.
Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY for the selected provider.
PDF filling currently requires an existing fillable PDF and a manually reviewed field map.`;

function parseOptions(args, requiredFlags = ["--profile", "--fields", "--provider"]) {
  const options = {};
  const allowed = new Set([...requiredFlags, "--model"]);
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || !value || value.startsWith("--") || options[name]) throw new Error(`Invalid option: ${name || "(missing)"}. Run oyb --help for usage.`);
    options[name] = value;
  }
  for (const required of requiredFlags) if (!options[required]) throw new Error(`Missing ${required}. Run oyb --help for usage.`);
  return options;
}

function formFromJson(text) {
  let form;
  try { form = JSON.parse(text); } catch { throw new Error("The fields file must contain valid JSON."); }
  if (!form || typeof form !== "object" || !Array.isArray(form.fields) || !form.fields.length) throw new Error("The fields file must contain a non-empty fields array.");
  const ids = new Set();
  for (const field of form.fields) {
    if (!field || typeof field.fieldId !== "string" || !field.fieldId.trim() || typeof field.label !== "string" || !field.label.trim() || ids.has(field.fieldId)) throw new Error("Every field needs a unique fieldId and a non-empty label.");
    ids.add(field.fieldId);
  }
  return { page: form.page && typeof form.page === "object" ? form.page : {}, fields: form.fields };
}

export async function runCli(args, { env = process.env, readText = path => readFile(path, "utf8"), analyze = analyzeForm, fillPdf = runPdfFill, out = text => process.stdout.write(text), err = text => process.stderr.write(text) } = {}) {
  try {
    if (!args.length || args[0] === "--help" || args[0] === "help") { out(`${HELP}\n`); return 0; }
    if (args[0] === "fill") {
      if (args.length === 2 && /\.pdf$/i.test(args[1])) { err("OYB needs a reviewed field map to fill this PDF. No file was changed.\n"); return 2; }
      const inputPath = args[1];
      if (!inputPath || !/\.pdf$/i.test(inputPath)) throw new Error("Expected an input PDF. Run oyb --help for usage.");
      const options = parseOptions(args.slice(2), ["--field-map", "--profile", "--provider", "--output"]);
      const provider = options["--provider"];
      const keyVariable = KEY_VARIABLES[provider];
      if (!keyVariable) throw new Error("Choose openai, anthropic, or gemini as the provider.");
      const apiKey = String(env[keyVariable] || "").trim();
      if (!apiKey) throw new Error(`Set ${keyVariable} before filling.`);
      const result = await fillPdf({ inputPath, outputPath: options["--output"], mapPath: options["--field-map"], profilePath: options["--profile"], provider, apiKey, model: options["--model"] || "" });
      out(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    if (args[0] !== "suggest") throw new Error(`Unknown command: ${args[0]}. Run oyb --help for usage.`);
    const options = parseOptions(args.slice(1));
    const provider = options["--provider"];
    const keyVariable = KEY_VARIABLES[provider];
    if (!keyVariable) throw new Error("Choose openai, anthropic, or gemini as the provider.");
    const apiKey = String(env[keyVariable] || "").trim();
    if (!apiKey) throw new Error(`Set ${keyVariable} before requesting suggestions.`);
    const [profile, formJson] = await Promise.all([readText(options["--profile"]), readText(options["--fields"])]);
    const { page, fields } = formFromJson(formJson);
    const skipped = fields.filter(field => isSensitiveField({ ...field, type: field.inputType })).map(field => ({ fieldId: field.fieldId, reason: "sensitive_field" }));
    const answerableFields = fields.filter(field => !skipped.some(item => item.fieldId === field.fieldId));
    if (!answerableFields.length) throw new Error("No non-sensitive fields were found.");
    const result = await analyze({ profile, provider, apiKey, model: options["--model"] || "", page, fields: answerableFields });
    out(`${JSON.stringify({ ...result, ...(skipped.length ? { skipped } : {}) }, null, 2)}\n`);
    return 0;
  } catch (error) {
    err(`OYB: ${error.message}\n`);
    return 1;
  }
}
