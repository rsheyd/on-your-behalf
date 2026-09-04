import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixture = await readFile(new URL("./long-form.html", import.meta.url), "utf8");

test("long-form fixture provides multiple large sections and repeated records", () => {
  assert.match(fixture, /Personal details/);
  assert.match(fixture, /Project history/);
  assert.match(fixture, /References/);
  assert.match(fixture, /projects\[\$\{row\}\]\.organization/);
  assert.match(fixture, /Personal field", 30/);
  assert.match(fixture, /Reference field", 30/);
});

test("long-form fixture blocks submission and exposes machine-readable state", () => {
  assert.match(fixture, /event\.preventDefault\(\)/);
  assert.match(fixture, /submitAttempts/);
  assert.match(fixture, /fixture-state/);
});
