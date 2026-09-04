import { readFile } from "node:fs/promises";
import { buildPrompt, parseFormAnalysis } from "../src/prompt.js";
import { generateSuggestions } from "../src/providers.js";
import { createFillCheckpoint, runFillLoop } from "../src/fill-runner.js";
import { employmentMemoryFixture } from "../test/support/employment-memory-fixture.js";

const apiKey = process.env.OPENAI_VALERIA_API_KEY;
if (!apiKey) throw new Error("OPENAI_VALERIA_API_KEY is not available in this shell.");
const fullProfile = await readFile(new URL("../roman-only/linkedin-profile.md", import.meta.url), "utf8");
const profile = fullProfile.slice(0, fullProfile.indexOf("### Software Engineer"));
const fixture = employmentMemoryFixture(Array.from({ length: 4 }, (_, index) => ({ company: `Wrong employer ${index + 1}`, title: "Wrong title", current: index < 2, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" })));
const options = { replaceExisting: true };
const generate = async ({ page, fields, recordContext, actions }) => {
  const prompt = buildPrompt({ profile, page, fields, recordContext, actions });
  const text = await generateSuggestions({ provider: "openai", apiKey, model: "gpt-4.1-mini", prompt });
  return parseFormAnalysis(text, fields, actions);
};
const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options, providerName: "OpenAI", generate, fill: payload => fixture.fill(payload), activate: action => fixture.addCount < 1 ? fixture.activate(action) : Promise.resolve({ ok: true, activated: false, scan: fixture.scan() }) });
const expected = [
  ["Good Engineering Co.", "Principal Engineer", true, "06", "2026", "", ""],
  ["NoBS.tech", "Observability Consultant", false, "05", "2025", "06", "2026"],
  ["RTech", "Independent Consultant & Volunteer", false, "09", "2023", "05", "2025"],
  ["Datadog", "Manager, Operations Engineering", false, "06", "2022", "09", "2023"],
  ["Datadog", "Senior Solutions Operations Engineer", false, "10", "2021", "06", "2022"]
];
const actual = fixture.rows.map(row => [row.company, row.title, row.current, row.startMonth, row.startYear, row.endMonth, row.endYear]);
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Employment result differed from the LinkedIn source:\n${JSON.stringify({ stopReason: result.stopReason, addCount: fixture.addCount, actual, expected }, null, 2)}`);
console.log(JSON.stringify({ ok: true, stopReason: result.stopReason, aiCalls: result.state.aiCalls, addCount: fixture.addCount, rows: actual }, null, 2));
