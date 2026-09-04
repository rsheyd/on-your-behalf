import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const fixture = fs.readFileSync(new URL("employment-history-form.html", import.meta.url), "utf8");

test("employment fixture starts with four populated synthetic rows", () => {
  const initialRows = fixture.match(/const initialRows = \[([^]*?)\n    \];/)?.[1] || "";
  assert.equal((initialRows.match(/company:/g) || []).length, 4);
  assert.doesNotMatch(initialRows, /company:\s*""/);
});

test("employment fixture mirrors indexed controls and dynamic end dates", () => {
  for (const prefix of ["Company", "JobFunction", "CurrentEmployment", "StartMonth", "StartYear", "EndMonth", "EndYear"]) assert.match(fixture, new RegExp(`${prefix}_\\$\\{index\\}`));
  assert.match(fixture, /control\.disabled = current\.checked/);
  assert.match(fixture, /if \(current\.checked\) control\.value = ""/);
});

test("employment fixture exposes bounded delays and machine-readable diagnostics", () => {
  assert.match(fixture, /Math\.min\(120000/);
  assert.match(fixture, /JSON\.stringify\(\{ fixtureDelayMs, addCount, mutationCount, submitAttempts, navigationAttempts, events, rows \}/);
});

test("employment fixture instruments add, submit, save, and continue actions", () => {
  assert.match(fixture, /id="add-employment"/);
  assert.match(fixture, /type: "add-employment"/);
  assert.match(fixture, /type: "submit-attempt"/);
  assert.match(fixture, /\["save", "continue"\]/);
});
