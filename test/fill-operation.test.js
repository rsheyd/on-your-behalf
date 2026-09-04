import test from "node:test";
import assert from "node:assert/strict";
import { actionsForActiveExpansion, actionsForReplacementPhase, adaptiveAiCallAllowance, coherentFieldBatches, extendReplacementSnapshot, fillLimitReason, reconcileCheckpointForResume, reconcileSuggestionQueue, replacementPhaseComplete, snapshotAddedEntries, snapshotReplacement, transitionOperationState } from "../src/fill-operation.js";

const repeatedField = (fieldId, entryOrdinal, role) => ({ fieldId, groupId: "employment", entryOrdinal, semanticHint: role });

test("snapshots the original repeated entries before row expansion", () => {
  const snapshot = snapshotReplacement([
    repeatedField("company-1", 1, "company"),
    repeatedField("title-1", 1, "title"),
    repeatedField("company-2", 2, "company"),
    { fieldId: "sector" }
  ]);
  assert.deepEqual(snapshot, { fieldIds: ["company-1", "title-1", "company-2"], entries: ["employment:1", "employment:2"] });
});

test("keeps queued suggestions for surviving fields after a dependent mutation", () => {
  const expectedFields = [repeatedField("company-1", 1, "company"), repeatedField("title-1", 1, "title"), repeatedField("company-2", 2, "company")];
  const suggestions = expectedFields.map(field => ({ fieldId: field.fieldId, value: field.fieldId }));
  assert.deepEqual(reconcileSuggestionQueue({ suggestions, expectedFields, currentFields: expectedFields.slice(1), completedIds: ["title-1"] }), [{ fieldId: "company-2", value: "company-2" }]);
});

test("adds newly revealed controls from an original entry to the replacement snapshot", () => {
  const initial = snapshotReplacement([repeatedField("company-1", 1, "company"), repeatedField("company-2", 2, "company")]);
  const extended = extendReplacementSnapshot(initial, [repeatedField("company-1", 1, "company"), repeatedField("end-year-1", 1, "end year"), repeatedField("company-3", 3, "company")]);
  assert.deepEqual(extended, { fieldIds: ["company-1", "company-2", "end-year-1"], entries: ["employment:1", "employment:2"] });
});

test("replacement completes only after every original field is settled", () => {
  const snapshot = { fieldIds: ["company-1", "title-1", "company-2"] };
  assert.equal(replacementPhaseComplete(snapshot, ["company-1", "title-1"]), false);
  assert.equal(replacementPhaseComplete(snapshot, ["company-1", "title-1", "company-2", "company-3"]), true);
});

test("hides add-row actions until the original replacement entries settle", () => {
  const actions = [{ actionId: "add", type: "add_repeat_entry" }];
  const snapshot = { fieldIds: ["company-1", "title-1"] };
  assert.deepEqual(actionsForReplacementPhase(actions, snapshot, ["company-1"]), []);
  assert.deepEqual(actionsForReplacementPhase(actions, snapshot, ["company-1", "title-1"]), actions);
});

test("a dependent rescan preserves row assignments and delays expansion", () => {
  const actions = [{ actionId: "add", type: "add_repeat_entry" }];
  const initialFields = [repeatedField("company-1", 1, "company"), repeatedField("current-1", 1, "current"), repeatedField("company-2", 2, "company"), repeatedField("current-2", 2, "current")];
  const suggestions = initialFields.map(field => ({ fieldId: field.fieldId, value: field.fieldId }));
  let snapshot = snapshotReplacement(initialFields);
  assert.deepEqual(actionsForReplacementPhase(actions, snapshot, []), []);

  const revealedFields = [...initialFields, repeatedField("end-year-2", 2, "end year")];
  snapshot = extendReplacementSnapshot(snapshot, revealedFields);
  const queued = reconcileSuggestionQueue({ suggestions, expectedFields: initialFields, currentFields: revealedFields, completedIds: ["current-2"] });
  assert.deepEqual(queued.map(item => item.fieldId), ["company-1", "current-1", "company-2"]);
  assert.deepEqual(actionsForReplacementPhase(actions, snapshot, ["current-2", ...queued.map(item => item.fieldId)]), []);
  assert.deepEqual(actionsForReplacementPhase(actions, snapshot, snapshot.fieldIds), actions);
});

test("an added entry must settle before another row action is available", () => {
  const actions = [{ actionId: "add", type: "add_repeat_entry" }];
  const before = [repeatedField("company-1", 1, "company")];
  const after = [...before, repeatedField("company-2", 2, "company"), repeatedField("title-2", 2, "title")];
  let expansion = snapshotAddedEntries(before, after);
  assert.deepEqual(expansion, { fieldIds: ["company-2", "title-2"], entries: ["employment:2"] });
  assert.deepEqual(actionsForActiveExpansion(actions, expansion, ["company-2"]), []);
  expansion = extendReplacementSnapshot(expansion, [...after, repeatedField("end-year-2", 2, "end year")]);
  assert.deepEqual(actionsForActiveExpansion(actions, expansion, ["company-2", "title-2"]), []);
  assert.deepEqual(actionsForActiveExpansion(actions, expansion, expansion.fieldIds), actions);
});

test("operation state survives progress and reaches a terminal result", () => {
  const started = transitionOperationState({}, { type: "start" });
  const progressing = transitionOperationState(started, { type: "progress", progress: 0.4 });
  assert.deepEqual(progressing, { status: "running", progress: 0.4, error: "" });
  const paused = transitionOperationState(progressing, { type: "pause" });
  assert.deepEqual(paused, { status: "paused", progress: 0.4, error: "" });
  assert.deepEqual(transitionOperationState(paused, { type: "resume" }), progressing);
  assert.deepEqual(transitionOperationState(progressing, { type: "complete" }), { status: "complete", progress: 1, error: "" });
  assert.deepEqual(transitionOperationState(progressing, { type: "fail", error: "Target tab closed" }), { status: "failed", progress: 0.4, error: "Target tab closed" });
});

test("resume keeps present completed work and discards stale queued suggestions", () => {
  const currentScan = { fields: [{ ...repeatedField("company-1", 1, "company"), empty: false }, repeatedField("title-2", 2, "title")] };
  const checkpoint = { filledIds: ["company-1"], blockedIds: [], queuedSuggestions: [{ fieldId: "company-1", value: "done" }, { fieldId: "title-2", value: "next" }, { fieldId: "removed", value: "stale" }], totalFilled: 1 };
  const resumed = reconcileCheckpointForResume(checkpoint, currentScan);
  assert.equal(resumed.totalFilled, 1);
  assert.deepEqual(resumed.currentScan, currentScan);
  assert.deepEqual(resumed.queuedSuggestions, [{ fieldId: "title-2", value: "next" }]);
});

test("resume reopens a completed field if the page was reset", () => {
  const checkpoint = { filledIds: ["company-1"], blockedIds: [], queuedSuggestions: [], totalFilled: 1 };
  const resumed = reconcileCheckpointForResume(checkpoint, { fields: [{ ...repeatedField("company-1", 1, "company"), empty: true }] });
  assert.deepEqual(resumed.filledIds, []);
});

test("batches long forms by section without splitting repeated entries", () => {
  const fields = [
    ...Array.from({ length: 18 }, (_, index) => ({ fieldId: `personal-${index}`, sectionId: "personal" })),
    ...Array.from({ length: 7 }, (_, index) => ({ ...repeatedField(`job-1-${index}`, 1, `role-${index}`), sectionId: "employment" })),
    ...Array.from({ length: 7 }, (_, index) => ({ ...repeatedField(`job-2-${index}`, 2, `role-${index}`), sectionId: "employment" })),
    ...Array.from({ length: 24 }, (_, index) => ({ fieldId: `reference-${index}`, sectionId: "references" }))
  ];
  const batches = coherentFieldBatches(fields, 20);
  assert.deepEqual(batches.map(batch => batch.length), [18, 14, 20, 4]);
  assert.equal(batches.some(batch => batch.some(field => field.fieldId === "job-1-0") && !batch.some(field => field.fieldId === "job-1-6")), false);
  assert.equal(adaptiveAiCallAllowance(fields, 20), 6);
});

test("keeps an oversized repeated entry intact", () => {
  const entry = Array.from({ length: 6 }, (_, index) => repeatedField(`entry-${index}`, 1, `role-${index}`));
  assert.deepEqual(coherentFieldBatches(entry, 4), [entry]);
});

test("progress-based limits distinguish completion, stalls, and bounded work", () => {
  const base = { pendingCount: 1, actionCount: 0, queuedCount: 0, elapsedMs: 100, maxDurationMs: 1000, domPasses: 1, maxDomPasses: 20, aiCalls: 1, maxAiCalls: 3, progressCount: 1, hasAppliedPass: true };
  assert.equal(fillLimitReason({ ...base, pendingCount: 0 }), "stable");
  assert.equal(fillLimitReason({ ...base, elapsedMs: 1000 }), "time_limit");
  assert.equal(fillLimitReason({ ...base, domPasses: 20 }), "dom_limit");
  assert.equal(fillLimitReason({ ...base, progressCount: 0 }), "no_progress");
  assert.equal(fillLimitReason({ ...base, aiCalls: 3 }), "ai_limit");
  assert.equal(fillLimitReason(base), "");
  assert.equal(fillLimitReason({ ...base, aiCalls: 3, queuedCount: 2 }), "");
});
