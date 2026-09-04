import { readFile } from "node:fs/promises";
import { buildPrompt, parseCollectionPlan, parseFormAnalysis } from "../src/prompt.js";
import { generateSuggestions } from "../src/providers.js";
import { createFillCheckpoint, runFillLoop } from "../src/fill-runner.js";
import { employmentMemoryFixture } from "../test/support/employment-memory-fixture.js";

const apiKey = process.env.OPENAI_VALERIA_API_KEY;
if (!apiKey) throw new Error("OPENAI_VALERIA_API_KEY is not available in this shell.");
const fullProfile = await readFile(new URL("../roman-only/linkedin-profile.md", import.meta.url), "utf8");
const profile = fullProfile.slice(0, fullProfile.indexOf("# Education"));
const fixture = employmentMemoryFixture([
  { company: "Good Engineering Co.", title: "Principal Engineer", current: true, startMonth: "6", startYear: "2026", endMonth: "", endYear: "" },
  { company: "NoBS.tech", title: "Observability Consultant", current: true, startMonth: "6", startYear: "2025", endMonth: "", endYear: "" },
  { company: "Good Engineering Co.", title: "Principal Engineer", current: true, startMonth: "6", startYear: "2026", endMonth: "", endYear: "" },
  { company: "NoBS.tech", title: "Observability Consultant", current: false, startMonth: "5", startYear: "2025", endMonth: "", endYear: "" },
  { company: "RTech", title: "Independent Consultant & Volunteer", current: false, startMonth: "9", startYear: "2023", endMonth: "", endYear: "" }
], { browserLike: true, rawIndexes: [0, 1, 2, 5, 7], jobRole: "job function", paddedMonths: false });
const options = { replaceExisting: true };
let capturedPlan = [];
let capturedPlanInvalid = [];
const generate = async ({ page, fields, recordContext, actions, replaceExisting, planCollection }) => {
  const prompt = buildPrompt({ profile, page, fields, recordContext, actions, replaceExisting, planCollection });
  const text = await generateSuggestions({ provider: "openai", apiKey, model: "gpt-4.1-mini", prompt });
  if (!planCollection) return parseFormAnalysis(text, fields, actions);
  const parsedPlan = parseCollectionPlan(text, fields);
  capturedPlan = parsedPlan.records;
  capturedPlanInvalid = parsedPlan.invalid;
  return { plan: capturedPlan, planInvalid: capturedPlanInvalid, suggestions: [], unresolved: [], actions: [] };
};
const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options, providerName: "OpenAI", generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action) });
const expected = [
  ["Good Engineering Co.", "Principal Engineer", true, "6", "2026", "", ""],
  ["NoBS.tech", "Observability Consultant", false, "5", "2025", "6", "2026"],
  ["RTech", "Independent Consultant & Volunteer", false, "9", "2023", "5", "2025"],
  ["Datadog", "Manager, Operations Engineering", false, "6", "2022", "9", "2023"],
  ["Datadog", "Senior Solutions Operations Engineer", false, "10", "2021", "6", "2022"],
  ["Datadog", "Software Engineer", false, "4", "2020", "10", "2021"],
  ["Datadog", "Solutions Operations Engineer", false, "9", "2018", "3", "2020"],
  ["Datadog", "Solutions Engineer", false, "1", "2018", "8", "2018"],
  ["Udacity", "iOS Developer Nanodegree Mentor", false, "8", "2017", "5", "2018"],
  ["CoffeeNow", "Software Engineer", false, "12", "2016", "1", "2018"],
  ["Charter Technology Solutions", "Senior Systems Engineer", false, "4", "2012", "9", "2016"]
];
const actual = fixture.rows.map(row => [row.company, row.title, row.current, row.startMonth, row.startYear, row.endMonth, row.endYear]);
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Employment result differed from the LinkedIn source:\n${JSON.stringify({ stopReason: result.stopReason, addCount: fixture.addCount, plan: capturedPlan, planInvalid: capturedPlanInvalid, actual, expected }, null, 2)}`);
console.log(JSON.stringify({ ok: true, stopReason: result.stopReason, aiCalls: result.state.aiCalls, addCount: fixture.addCount, rows: actual }, null, 2));
