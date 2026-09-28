import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const INSPECTOR = fileURLToPath(new URL("../scripts/inspect-pdf-fields.py", import.meta.url));

export async function inspectPdf(path, { python = process.env.OYB_PYTHON || "python3", exec = execute } = {}) {
  let stdout;
  try { ({ stdout } = await exec(python, [INSPECTOR, path], { maxBuffer: 4_000_000 })); }
  catch (error) { throw new Error(error.stderr?.trim() || "Could not inspect this PDF. Install pypdf for the selected Python interpreter."); }
  return JSON.parse(stdout);
}
