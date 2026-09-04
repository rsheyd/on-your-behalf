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
const collectionPlan = records.map(record => Object.fromEntries(["company", "job title", "current employment", "start month", "start year", "end month", "end year"].map(role => [role, valueFor(record, role)])));

test("production fill loop replaces every existing record before adding remaining records", async () => {
  const fixture = employmentMemoryFixture(Array.from({ length: 4 }, (_, index) => ({ company: `Wrong ${index + 1}`, title: "Wrong", current: index < 2, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" })));
  const generate = async ({ fields, recordContext, actions, planCollection }) => {
    if (planCollection) return { plan: collectionPlan, suggestions: [], unresolved: [], actions: [] };
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

test("production fill loop preserves assignments across browser-like checkbox rescans", async () => {
  const fixture = employmentMemoryFixture(Array.from({ length: 4 }, (_, index) => ({ company: `Wrong ${index + 1}`, title: "Wrong", current: index < 2, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" })), { browserLike: true, rawIndexes: [0, 1, 2, 5] });
  const generate = async ({ fields, recordContext, actions, planCollection }) => planCollection ? { plan: collectionPlan, suggestions: [], unresolved: [], actions: [] } : ({ suggestions: fields.map(field => ({ fieldId: field.fieldId, value: valueFor(records[field.entryOrdinal - 1], field.semanticHint), basis: "supported" })).filter(item => item.value !== undefined), unresolved: [], actions: actions.length && recordContext.length < 33 ? [{ actionId: actions[0].actionId, type: "add_repeat_entry" }] : [] });
  const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options: { replaceExisting: true }, generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action) });
  assert.equal(result.stopReason, "stable");
  assert.equal(fixture.addCount, 1);
  assert.deepEqual(fixture.rows, records);
});

test("production fill loop honors cancellation before another page mutation", async () => {
  const fixture = employmentMemoryFixture([{ company: "Wrong", title: "Wrong", current: false, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" }]);
  const controller = new AbortController();
  let fillCalls = 0;
  await assert.rejects(() => runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options: { replaceExisting: true }, signal: controller.signal, generate: async ({ fields, planCollection }) => { controller.abort(); return planCollection ? { plan: [collectionPlan[0]], suggestions: [], unresolved: [], actions: [] } : { suggestions: fields.map(field => ({ fieldId: field.fieldId, value: "replacement", basis: "supported" })), unresolved: [], actions: [] }; }, fill: async payload => { fillCalls += 1; return fixture.fill(payload); }, activate: action => fixture.activate(action) }), error => error.name === "AbortError");
  assert.equal(fillCalls, 0);
  assert.equal(fixture.rows[0].company, "Wrong");
});

test("production fill loop applies a validated collection plan without repeated AI calls", async () => {
  const fixture = employmentMemoryFixture([{ company: "Wrong", title: "Wrong", current: false, startMonth: "01", startYear: "2020", endMonth: "02", endYear: "2021" }]);
  let calls = 0;
  const generate = async ({ fields, planCollection }) => {
    calls += 1;
    if (planCollection) return { plan: [collectionPlan[0]], suggestions: [], unresolved: [], actions: [] };
    if (calls === 1) return { suggestions: [], unresolved: [], invalid: [{ fieldId: fields[2].fieldId, reason: "invalid_value" }] };
    return { suggestions: fields.map(field => ({ fieldId: field.fieldId, value: valueFor(records[0], field.semanticHint), basis: "supported" })).filter(item => item.value !== undefined), unresolved: [], actions: [] };
  };
  const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options: { replaceExisting: true }, generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action) });
  assert.equal(result.stopReason, "stable");
  assert.equal(calls, 1);
  assert.deepEqual(fixture.rows[0], records[0]);
});

test("production fill loop confirms one declined add-row decision", async () => {
  const fixture = employmentMemoryFixture(records.slice(0, 4));
  let actionDecisions = 0;
  const generate = async ({ fields, actions }) => {
    if (fields.length) return { suggestions: [], unresolved: fields.map(field => ({ fieldId: field.fieldId, reason: "not_applicable" })), actions: [] };
    actionDecisions += 1;
    return { suggestions: [], unresolved: [], actions: actionDecisions === 2 ? [{ actionId: actions[0].actionId, type: "add_repeat_entry" }] : [] };
  };
  const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), false), options: { replaceExisting: false }, generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action) });
  assert.equal(actionDecisions, 2);
  assert.equal(fixture.addCount, 1);
  assert.ok(["stable", "no_progress"].includes(result.stopReason));
});

function valueFor(record, role) {
  if (!record) return undefined;
  return ({ company: record.company, "job title": record.title, "current employment": record.current, "start month": record.startMonth, "start year": record.startYear, "end month": record.endMonth, "end year": record.endYear })[role];
}
