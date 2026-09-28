import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileExport } from "../src/profile-export.js";
import { importProfile, loadProfile } from "../bin/profile-store.js";

test("extension export imports into private CLI storage and retains enabled selection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "oyb-profile-test-"));
  try {
    const archive = createProfileExport("Synthetic profile", [
      { id: "one", name: "Enabled reference", type: "txt", text: "Useful facts", enabled: true },
      { id: "two", name: "Disabled reference", type: "txt", text: "Do not include", enabled: false }
    ]);
    const zip = join(directory, "export.zip");
    const destination = join(directory, "stored", "profile.json");
    await writeFile(zip, Buffer.from(await archive.arrayBuffer()));
    const result = await importProfile(zip, { destination });
    assert.equal(result.supportingDocuments, 2);
    assert.equal(result.enabledDocuments, 1);
    const loaded = await loadProfile({ location: destination });
    assert.equal(loaded.profile, "Synthetic profile");
    assert.deepEqual(loaded.supportingDocuments.map(document => document.name), ["Enabled reference"]);
    assert.doesNotMatch(await readFile(destination, "utf8"), /apiKey/);
    await writeFile(zip, "invalid archive");
    await assert.rejects(importProfile(zip, { destination }), /Invalid OYB profile export/);
    assert.equal((await loadProfile({ location: destination })).profile, "Synthetic profile");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
