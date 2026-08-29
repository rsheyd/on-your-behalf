import test from "node:test";
import assert from "node:assert/strict";
import "../src/form-state.js";

const {
  compareFieldScans,
  fieldFingerprint,
  logicalFieldKey,
  nextRoundDecision,
  pendingFields,
  reconcileUnresolved,
  stableFieldId,
  unansweredFields,
  validSuggestionsForScan
} = globalThis.OpenFormFillerState;

function field(fieldId, overrides = {}) {
  return {
    fieldId,
    kind: "input",
    inputType: "text",
    label: fieldId,
    name: fieldId,
    required: false,
    options: [],
    ...overrides
  };
}

test("builds stable logical keys from DOM identity with safe fallbacks", () => {
  assert.equal(logicalFieldKey({ domId: "activity:type", name: "ignored", kind: "custom-select", label: "Activity Type" }), "id:activity:type");
  assert.equal(logicalFieldKey({ name: "contact", kind: "radio", domId: "contact-email", label: "Email" }), "name:radio:contact");
  assert.equal(logicalFieldKey({ name: "position", kind: "input", label: "Position" }), "name:input:position:0");
  assert.equal(logicalFieldKey({ name: "position", kind: "input", label: "Position" }, 1), "name:input:position:1");
  assert.equal(logicalFieldKey({ kind: "input", label: "Position Applied For", occurrence: 2 }, 2), "label:input:position applied for:2");
});

test("preserves IDs on surviving elements and reuses them for replacements", () => {
  const identities = new Map();
  let counter = 0;
  const createId = () => `field-${++counter}`;
  assert.equal(stableFieldId({ logicalKey: "id:activity-type", currentId: "existing", identityMap: identities, createId }), "existing");
  assert.equal(stableFieldId({ logicalKey: "id:activity-type", identityMap: identities, createId }), "existing");
  assert.equal(stableFieldId({ logicalKey: "id:activity-description", identityMap: identities, createId }), "field-1");
  assert.equal(stableFieldId({ logicalKey: "id:activity-description", identityMap: identities, createId }), "field-1");
  assert.equal(stableFieldId({ logicalKey: "id:activity-description", currentId: "surviving", identityMap: identities, createId }), "surviving");
  assert.equal(stableFieldId({ logicalKey: "id:activity-description", identityMap: identities, createId }), "surviving");
});

test("fingerprints relevant metadata and option changes", () => {
  const original = field("type", { kind: "custom-select", options: [{ value: "1", label: "Employer Contact" }] });
  assert.equal(fieldFingerprint(original), fieldFingerprint({ ...original, logicalKey: "different", domId: "replacement" }));
  assert.notEqual(fieldFingerprint(original), fieldFingerprint({ ...original, options: [{ value: "3", label: "Preparation" }] }));
});

test("classifies new, changed, unchanged, and disappeared fields", () => {
  const previous = [
    field("date"),
    field("description", { options: [{ value: "0", label: "Select" }] }),
    field("removed")
  ];
  const current = [
    field("date"),
    field("description", { options: [{ value: "100", label: "Inquiry" }] }),
    field("position")
  ];
  const result = compareFieldScans(previous, current);
  assert.deepEqual(result.unchangedFields.map(item => item.fieldId), ["date"]);
  assert.deepEqual(result.changedFields.map(item => item.fieldId), ["description"]);
  assert.deepEqual(result.newFields.map(item => item.fieldId), ["position"]);
  assert.deepEqual(result.disappearedFields.map(item => item.fieldId), ["removed"]);
});

test("selects new unanswered fields and reconsiders changed unresolved fields", () => {
  const comparison = {
    newFields: [field("new"), field("filled")],
    changedFields: [field("changed"), field("resolved"), field("changed-filled")]
  };
  assert.deepEqual(pendingFields(comparison, {
    filledIds: ["filled", "changed-filled"],
    resolvedIds: ["resolved"]
  }).map(item => item.fieldId), ["new", "changed", "resolved"]);
});

test("selects visible empty fields while preserving existing and blocked values", () => {
  assert.deepEqual(unansweredFields([
    field("empty", { empty: true }),
    field("existing", { empty: false }),
    field("filled", { empty: true }),
    field("resolved", { empty: true }),
    field("blocked", { empty: true })
  ], {
    filledIds: ["filled"],
    resolvedIds: ["resolved"],
    blockedIds: ["blocked"]
  }).map(item => item.fieldId), ["empty"]);
});

test("reconciles unresolved fields with visibility and answered state", () => {
  const result = reconcileUnresolved({
    previous: [
      { fieldId: "kept", reason: "missing_profile_info" },
      { fieldId: "gone", reason: "missing_profile_info" },
      { fieldId: "answered", reason: "missing_profile_info" }
    ],
    updates: [
      { fieldId: "kept", reason: "requires_user_judgment" },
      { fieldId: "new", reason: "missing_profile_info" }
    ],
    visibleFields: [field("kept"), field("answered"), field("new")],
    answeredIds: ["answered"],
    invalidatedIds: ["kept"]
  });
  assert.deepEqual(result, [
    { fieldId: "kept", reason: "requires_user_judgment" },
    { fieldId: "new", reason: "missing_profile_info" }
  ]);
});

test("rejects suggestions for removed or meaningfully changed fields", () => {
  const expected = [
    field("kept"),
    field("changed", { options: [{ value: "0", label: "Select" }] }),
    field("removed")
  ];
  const current = [
    field("kept"),
    field("changed", { options: [{ value: "100", label: "Inquiry" }] })
  ];
  assert.deepEqual(validSuggestionsForScan([
    { fieldId: "kept", value: "value" },
    { fieldId: "changed", value: "0" },
    { fieldId: "removed", value: "gone" }
  ], expected, current), [{ fieldId: "kept", value: "value" }]);
});

test("makes bounded round decisions", () => {
  assert.deepEqual(nextRoundDecision({ completedRounds: 0, maxRounds: 6, pendingCount: 2, progressCount: 0 }), { continue: true, reason: "pending_fields" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 2, maxRounds: 6, pendingCount: 0, progressCount: 1 }), { continue: false, reason: "stable" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 2, maxRounds: 6, pendingCount: 2, progressCount: 0 }), { continue: false, reason: "no_progress" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 6, maxRounds: 6, pendingCount: 2, progressCount: 1 }), { continue: false, reason: "round_limit" });
});
