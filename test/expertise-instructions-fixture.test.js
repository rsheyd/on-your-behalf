import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const fixture = await readFile(new URL("./expertise-instructions-form.html", import.meta.url), "utf8");

test("expertise fixture separates indexed categories from instructed keyword fields", () => {
  assert.match(fixture, /Please provide keywords/);
  assert.match(fixture, /Please use commas to separate items/);
  assert.match(fixture, /Area_0/);
  assert.match(fixture, /ResearchInterests_0/);
  assert.match(fixture, /Add Another Area of Expertise/);
});

test("production scanner captures shared instructions without inventing a repeated collection", { skip: process.platform !== "darwin", timeout: 15000 }, async () => {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", `--user-data-dir=/tmp/oyb-expertise-scanner-test-${process.pid}`, "--virtual-time-budget=1000", "--dump-dom", new URL("./expertise-instructions-form.html", import.meta.url).href]);
  let output = "";
  let errors = "";
  child.stdout.on("data", chunk => { output += chunk; if (/data-keyword-instruction-captured="true"/.test(output) && /data-repeated-group-count="0"/.test(output)) child.kill("SIGINT"); });
  child.stderr.on("data", chunk => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Headless scanner timed out. ${errors}`)); }, 10000);
    child.on("error", reject);
    child.on("close", () => { clearTimeout(timeout); resolve(); });
  });
  assert.match(output, /data-keyword-instruction-captured="true"/);
  assert.match(output, /data-repeated-group-count="0"/);
});

test("production scanner associates each indexed explanation with its own screening question", { skip: process.platform !== "darwin", timeout: 15000 }, async () => {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-background-networking", "--no-first-run", `--user-data-dir=/tmp/oyb-screening-scanner-test-${process.pid}`, "--virtual-time-budget=1000", "--dump-dom", new URL("./expert-screening-form.html", import.meta.url).href]);
  let output = "";
  let errors = "";
  child.stdout.on("data", chunk => { output += chunk; if (/data-explanation-labels=/.test(output)) child.kill("SIGINT"); });
  child.stderr.on("data", chunk => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Headless scanner timed out. ${errors}`)); }, 10000);
    child.on("error", reject);
    child.on("close", () => { clearTimeout(timeout); resolve(); });
  });
  assert.match(output, /data-explanation-labels="[^"]*directly involved/);
  assert.match(output, /data-explanation-labels="[^"]*detailed features/);
  assert.match(output, /data-explanation-labels="[^"]*pricing models/);
  assert.doesNotMatch(output, /data-explanation-labels="[^"]*q9587168 explain/);
});
