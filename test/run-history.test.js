import test from "node:test";
import assert from "node:assert/strict";
import { appendRunHistory, appendTrace, compactCollectionPlan, compactFields, compactSuggestions } from "../src/run-history.js";

test("run history keeps the newest ten unique operations", () => {
  let history = [];
  for (let index = 0; index < 12; index += 1) history = appendRunHistory(history, { operationId: String(index) });
  assert.deepEqual(history.map(item => item.operationId), ["11", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);
  history = appendRunHistory(history, { operationId: "7", status: "canceled" });
  assert.equal(history[0].status, "canceled");
  assert.equal(history.filter(item => item.operationId === "7").length, 1);
});

test("trace and diagnostic payloads are bounded and compact", () => {
  let trace = [];
  for (let index = 0; index < 205; index += 1) trace = appendTrace(trace, { index });
  assert.equal(trace.length, 200);
  assert.equal(trace[0].index, 5);
  assert.equal(compactFields([{ fieldId: "one", currentValue: "x".repeat(500) }])[0].currentValue.length, 300);
  assert.deepEqual(compactSuggestions([{ fieldId: "one", value: true, basis: "supported" }]), [{ fieldId: "one", value: true, basis: "supported" }]);
  assert.deepEqual(compactCollectionPlan([{ company: "Example", date: "x".repeat(500) }]), [{ company: "Example", date: "x".repeat(300) }]);
});
