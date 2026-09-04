import test from "node:test";
import assert from "node:assert/strict";
import "../src/form-state.js";

const {
  compareFieldScans,
  customOptionDisplayLabel,
  fieldFingerprint,
  isAddRepeatAction,
  logicalFieldKey,
  nextRoundDecision,
  orderSuggestionsForFill,
  pendingFields,
  reconcileUnresolved,
  repeatedEntryOrdinal,
  semanticFieldHint,
  stableFieldId,
  unansweredFields,
  validSuggestionsForScan,
  validRepeatedGroupIds,
  visualEntryOrdinal
} = globalThis.OpenFormFillerState;

test("maps hidden custom-select values to their visible labels", () => {
  const options = [
    { value: "0", label: "-- Select One --" },
    { value: "1", label: "Employer Contact" }
  ];
  assert.equal(customOptionDisplayLabel("1", options), "Employer Contact");
  assert.equal(customOptionDisplayLabel("Employer Contact", options), "Employer Contact");
  assert.equal(customOptionDisplayLabel("unknown", options), "unknown");
});

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

test("derives repeated entry ordinals and semantic hints from common field identities", () => {
  assert.equal(repeatedEntryOrdinal({ domId: "StartMonth_0" }), 1);
  assert.equal(repeatedEntryOrdinal({ name: "employment[3][company]" }), 4);
  assert.equal(repeatedEntryOrdinal({ name: "company" }), 0);
  assert.equal(semanticFieldHint({ domId: "StartMonth_2" }), "start month");
  assert.equal(semanticFieldHint({ name: "employment[3][job_title]" }), "employment job title");
});

test("requires multiple roles to repeat before treating fields as a repeated collection", () => {
  const employment = [1, 2].flatMap(entryOrdinal => ["company", "job title"].map(semanticHint => ({ groupId: "employment", entryOrdinal, semanticHint })));
  const mixedExpertise = [1, 2, 3].map(entryOrdinal => ({ groupId: "expertise", entryOrdinal, semanticHint: "category" })).concat([{ groupId: "expertise", entryOrdinal: 1, semanticHint: "research interests" }]);
  assert.deepEqual([...validRepeatedGroupIds([...employment, ...mixedExpertise])], ["employment"]);
});

test("normalizes gapped raw indexes into visual entry order", () => {
  const maps = new Map();
  assert.deepEqual([1, 2, 3, 6, 7, 6].map(raw => visualEntryOrdinal(raw, "employment", maps)), [1, 2, 3, 4, 5, 4]);
});

test("recognizes only non-navigating add-row actions", () => {
  assert.equal(isAddRepeatAction({ label: "Add Another Company" }), true);
  assert.equal(isAddRepeatAction({ label: "+ Add new reference", anchor: true, href: "#" }), true);
  assert.equal(isAddRepeatAction({ label: "Add and continue" }), false);
  assert.equal(isAddRepeatAction({ label: "Add employer", anchor: true, href: "/next" }), false);
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

test("includes existing values only when replacement is enabled", () => {
  const fields = [field("empty", { empty: true }), field("existing", { empty: false }), field("already-filled", { empty: false })];
  assert.deepEqual(unansweredFields(fields, { includeExisting: true, filledIds: ["already-filled"] }).map(item => item.fieldId), ["empty", "existing"]);
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

test("orders checkbox state changes around the rest of a repeated record", () => {
  const fields = [field("current-a", { kind: "checkbox" }), field("company", { kind: "input" }), field("end-year", { kind: "select" }), field("current-b", { kind: "checkbox" })];
  const suggestions = [{ fieldId: "current-a", value: true }, { fieldId: "company", value: "Example Co." }, { fieldId: "end-year", value: "2025" }, { fieldId: "current-b", value: false }];
  assert.deepEqual(orderSuggestionsForFill(suggestions, fields).map(item => item.fieldId), ["current-b", "company", "end-year", "current-a"]);
});

test("makes bounded round decisions", () => {
  assert.deepEqual(nextRoundDecision({ completedRounds: 0, maxRounds: 6, pendingCount: 2, progressCount: 0 }), { continue: true, reason: "pending_fields" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 2, maxRounds: 6, pendingCount: 0, progressCount: 1 }), { continue: false, reason: "stable" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 2, maxRounds: 6, pendingCount: 2, progressCount: 0 }), { continue: false, reason: "no_progress" });
  assert.deepEqual(nextRoundDecision({ completedRounds: 6, maxRounds: 6, pendingCount: 2, progressCount: 1 }), { continue: false, reason: "round_limit" });
});
