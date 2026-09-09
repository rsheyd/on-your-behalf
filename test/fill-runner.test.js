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
  const events = [];
  const generate = async ({ fields, planCollection }) => {
    calls += 1;
    if (planCollection) return { plan: [collectionPlan[0]], suggestions: [], unresolved: [], actions: [] };
    if (calls === 1) return { suggestions: [], unresolved: [], invalid: [{ fieldId: fields[2].fieldId, reason: "invalid_value" }] };
    return { suggestions: fields.map(field => ({ fieldId: field.fieldId, value: valueFor(records[0], field.semanticHint), basis: "supported" })).filter(item => item.value !== undefined), unresolved: [], actions: [] };
  };
  const result = await runFillLoop({ state: createFillCheckpoint(fixture.scan(), true), options: { replaceExisting: true }, generate, fill: payload => fixture.fill(payload), activate: action => fixture.activate(action), onEvent: async (type, data) => events.push({ type, data }) });
  assert.equal(result.stopReason, "stable");
  assert.equal(calls, 1);
  assert.deepEqual(fixture.rows[0], records[0]);
  assert.ok(events.some(event => event.type === "batch_selected" && event.data.source === "saved_plan"));
  assert.ok(events.some(event => event.type === "plan_applied" && event.data.suggestedFieldIds.length));
  assert.ok(events.some(event => event.type === "loop_progress" && event.data.filledCount));
  assert.ok(events.some(event => event.type === "stop_evaluation" && event.data.decision === "stable"));
});

test("diagnostics record stranded fields and the values behind a stop decision", async () => {
  const field = { fieldId: "later", kind: "input", inputType: "text", label: "Later compliance question", empty: true, currentValue: "" };
  const scan = { fields: [field], actions: [], page: {} };
  const events = [];
  const result = await runFillLoop({
    state: createFillCheckpoint(scan, false),
    options: { replaceExisting: false },
    generate: async () => ({ suggestions: [], unresolved: [], invalid: [], actions: [] }),
    fill: async () => { throw new Error("fill should not run"); },
    activate: async () => { throw new Error("activate should not run"); },
    onEvent: async (type, data) => events.push({ type, data })
  });
  assert.equal(result.stopReason, "no_answers");
  assert.deepEqual(events.find(event => event.type === "stop_evaluation")?.data, { decision: "no_answers", pendingCount: 1, actionCount: 0, queuedCount: 0, progressCount: 1, aiCalls: 1, aiAllowance: 3 });
  assert.deepEqual(events.find(event => event.type === "fields_stranded")?.data.fields, [{ fieldId: "later", label: "Later compliance question" }]);
});

test("an incomplete replacement plan resolves its missing fields and continues to ordinary fields", async () => {
  const fields = [
    { fieldId: "planned", kind: "input", inputType: "text", label: "Planned role", groupId: "screening", groupLabel: "Screening", entryOrdinal: 1, semanticHint: "planned role", sectionId: "screening", empty: false, currentValue: "old" },
    { fieldId: "missing", kind: "input", inputType: "text", label: "Missing role", groupId: "screening", groupLabel: "Screening", entryOrdinal: 1, semanticHint: "missing role", sectionId: "screening", empty: true, currentValue: "" },
    { fieldId: "ordinary", kind: "radio", label: "Later compliance question", sectionId: "compliance", empty: true, currentValue: "", options: [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }] }
  ];
  let currentFields = fields.map(field => ({ ...field }));
  const events = [];
  let calls = 0;
  const generate = async ({ fields: requested, planCollection }) => {
    calls += 1;
    if (planCollection) return { plan: [{ "planned role": "new" }], suggestions: [], unresolved: [], actions: [] };
    return { suggestions: requested.map(field => ({ fieldId: field.fieldId, value: "No", basis: "chosen" })), unresolved: [], invalid: [], actions: [] };
  };
  const fill = async ({ suggestions }) => {
    const answered = new Set(suggestions.map(item => item.fieldId));
    currentFields = currentFields.map(field => answered.has(field.fieldId) ? { ...field, empty: false, currentValue: "updated" } : field);
    return { ok: true, filled: answered.size, filledIds: [...answered], failed: [], skipped: [], basisCounts: { supported: 0, inferred: 0, chosen: 0 }, mutated: false, remainingSuggestions: [], scan: { fields: currentFields, actions: [], page: {} } };
  };
  const result = await runFillLoop({ state: createFillCheckpoint({ fields: currentFields, actions: [], page: {} }, true), options: { replaceExisting: true }, generate, fill, activate: async () => ({ ok: true, activated: false }), onEvent: async (type, data) => events.push({ type, data }) });
  assert.equal(result.stopReason, "stable");
  assert.equal(calls, 2);
  assert.deepEqual(result.state.unresolved, [{ fieldId: "missing", reason: "missing_profile_info" }]);
  assert.ok(result.state.filledIds.includes("ordinary"));
  assert.deepEqual(events.find(event => event.type === "plan_applied")?.data.missingFromPlan, [{ fieldId: "missing", label: "Missing role" }]);
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
