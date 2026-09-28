import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../bin/cli.js";

function harness({ env = {}, form = { page: { title: "Example" }, fields: [{ fieldId: "name", kind: "input", label: "Name" }] }, profile = "My name is Example Person.", analyze = async () => ({ suggestions: [], unresolved: [] }) } = {}) {
  const output = [];
  const errors = [];
  const calls = [];
  const dependencies = {
    env,
    readText: async path => path === "profile.txt" ? profile : JSON.stringify(form),
    analyze: async input => { calls.push(input); return analyze(input); },
    out: text => output.push(text),
    err: text => errors.push(text)
  };
  return { dependencies, output, errors, calls };
}

test("CLI suggestion command uses the selected environment key and shared engine", async () => {
  const { dependencies, output, calls } = harness({ env: { OPENAI_API_KEY: "private-test-key" } });
  const code = await runCli(["suggest", "--profile", "profile.txt", "--fields", "form.json", "--provider", "openai"], dependencies);
  assert.equal(code, 0);
  assert.equal(calls[0].apiKey, "private-test-key");
  assert.equal(calls[0].fields[0].label, "Name");
  assert.doesNotMatch(output.join(""), /private-test-key|My name is/);
});

test("CLI filters sensitive fields before contacting the provider", async () => {
  const form = { fields: [{ fieldId: "password", kind: "input", inputType: "password", label: "Password" }, { fieldId: "name", kind: "input", label: "Name" }] };
  const { dependencies, output, calls } = harness({ env: { OPENAI_API_KEY: "key" }, form });
  assert.equal(await runCli(["suggest", "--profile", "profile.txt", "--fields", "form.json", "--provider", "openai"], dependencies), 0);
  assert.deepEqual(calls[0].fields.map(field => field.fieldId), ["name"]);
  assert.deepEqual(JSON.parse(output.join("")).skipped, [{ fieldId: "password", reason: "sensitive_field" }]);
});

test("CLI requires its provider key without making a request", async () => {
  const { dependencies, errors, calls } = harness();
  assert.equal(await runCli(["suggest", "--profile", "profile.txt", "--fields", "form.json", "--provider", "gemini"], dependencies), 1);
  assert.match(errors.join(""), /GEMINI_API_KEY/);
  assert.equal(calls.length, 0);
});

test("CLI fill reports unsupported PDF operation without reading the file or using a key", async () => {
  const { dependencies, errors, calls } = harness();
  assert.equal(await runCli(["fill", "document.pdf"], dependencies), 2);
  assert.match(errors.join(""), /needs a reviewed field map/);
  assert.equal(calls.length, 0);
});

test("CLI routes a reviewed PDF fill with the selected environment key", async () => {
  const { dependencies, output } = harness({ env: { OPENAI_API_KEY: "private-test-key" } });
  let payload;
  dependencies.fillPdf = async options => { payload = options; return { output: options.outputPath, filled: 1 }; };
  const code = await runCli(["fill", "prepared.pdf", "--field-map", "reviewed.json", "--profile", "profile.txt", "--provider", "openai", "--output", "filled.pdf"], dependencies);
  assert.equal(code, 0);
  assert.equal(payload.apiKey, "private-test-key");
  assert.equal(payload.mapPath, "reviewed.json");
  assert.equal(payload.outputPath, "filled.pdf");
  assert.doesNotMatch(output.join(""), /private-test-key/);
});
