import { execFile as execute } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execute);
const EXTRACTOR = fileURLToPath(new URL("../scripts/extract-pdf-questions.py", import.meta.url));

export async function extractPdfQuestions(inputPath, outputPath, { python = process.env.OYB_PYTHON || "python3", exec = execFile } = {}) {
  try {
    const { stdout } = await exec(python, [EXTRACTOR, inputPath, outputPath], { maxBuffer: 2 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    throw new Error(error.stderr?.trim() || "Could not extract PDF questions. Check pdfplumber, Tesseract, and Poppler.");
  }
}
