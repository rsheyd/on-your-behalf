import test from "node:test";
import assert from "node:assert/strict";
import { createFillCheckpoint, runFillLoop } from "../src/fill-runner.js";
import { employmentMemoryFixture } from "./support/employment-memory-fixture.js";

const records = [
  { company: "Good Engineering Co.", title: "Principal Engineer", current: true, startMonth: "06", startYear: "2026", endMonth: "", endYear: "" },
  { company: "NoBS.tech", title: "Observability Consultant", current: false, startMonth: "05", startYear: "2025", endMonth: "06", endYear: "2026" },
  { company: "RTech", title: "Independent Consultant & Volunteer", current: false, startMonth: "09", startYear: "2023", endMonth: "05", endYear: "2025" },
  { company: "Datadog", title: "Manager, Operations Engineering", current: false, startMonth: "06", startYear: "2022", endMonth: "09", endYear: "2023" },
  { company: "Datadog", title: "Senior Solutions Operations Engineer", current: false, startMonth: "10", startYear: "2021", endMonth: "06", endYear: "2022" }
];

test("production fill loop replaces every existing record before adding remaining records", async () => {
  const fixture = employmentMemoryFixture(Array.from({ length: 4 }, (_, index) => ({ company: `Wrong ${index + 1}`, title: "Wrong", current: index < 2, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" })));
  const generate = async ({ fields, recordContext, actions }) => {
    const suggestions = fields.map(field => ({ fieldId: field.fieldId, value: valueFor(records[field.entryOrdinal - 1], field.semanticHint), basis: "supported" })).filter(item => item.value !== undefined);
    const represented = new Set(recordContext.filter(field => field.semanticHint === "company").map(field => field.currentValue));
    const shouldAdd = actions.length && records.some(record => !represented.has(record.company) || (record.company === "Datadog" && !recordContext.some(field => field.semanticHint === "job title" && field.currentValue === record.title)));
    return { suggestions, unresolved: [], actions: shouldAdd ? [{ actionId: actions[0].actionId, type: "add_repeat_entry" }] : [] };
  };
  const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options: { replaceExisting: true }, generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action) });
  assert.equal(result.stopReason, "stable");
  assert.equal(fixture.addCount, 1);
  assert.deepEqual(fixture.rows, records);
});

function valueFor(record, role) {
  if (!record) return undefined;
  return ({ company: record.company, "job title": record.title, "current employment": record.current, "start month": record.startMonth, "start year": record.startYear, "end month": record.endMonth, "end year": record.endYear })[role];
}
