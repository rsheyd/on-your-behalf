import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { enabledSupportingDocuments, validateSupportingDocuments } from "../src/supporting-documents.js";

const execute = promisify(execFile);
const READER = fileURLToPath(new URL("../scripts/read-profile-export.py", import.meta.url));
export const profileStorePath = () => join(process.platform === "darwin" ? join(homedir(), "Library", "Application Support") : process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "On Your Behalf", "cli", "profile.json");

export async function importProfile(zipPath, { destination = profileStorePath(), python = process.env.OYB_PYTHON || "python3" } = {}) {
  let stdout;
  try { ({ stdout } = await execute(python, [READER, zipPath], { maxBuffer: 2_000_000 })); }
  catch (error) { throw new Error(error.stderr?.trim() || "Could not read the OYB profile export."); }
  const imported = JSON.parse(stdout);
  const documents = validateSupportingDocuments(imported.supportingDocuments);
  const profile = String(imported.profile || "");
  if (!profile.trim() && !enabledSupportingDocuments(documents).length) throw new Error("The export has no usable profile or enabled supporting documents.");
  const directory = dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.profile-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ format: "oyb-profile", version: 1, profile, supportingDocuments: documents }), { mode: 0o600, flag: "wx" });
    await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
  return { location: destination, supportingDocuments: documents.length, enabledDocuments: enabledSupportingDocuments(documents).length };
}

export async function loadProfile({ location = profileStorePath() } = {}) {
  let stored;
  try { stored = JSON.parse(await readFile(location, "utf8")); }
  catch (error) { if (error.code === "ENOENT") throw new Error("Import a profile first with oyb import-profile export.zip, or pass --profile."); throw error; }
  if (stored.format !== "oyb-profile" || stored.version !== 1 || typeof stored.profile !== "string") throw new Error("The imported OYB profile is invalid; import it again.");
  return { profile: stored.profile, supportingDocuments: enabledSupportingDocuments(validateSupportingDocuments(stored.supportingDocuments)) };
}
