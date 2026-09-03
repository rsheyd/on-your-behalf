import test from "node:test";
import assert from "node:assert/strict";
import { actionsInScope, availableSections, fieldsInScope } from "../src/form-scope.js";

const fields = [
  { fieldId: "name", sectionId: "personal:0", sectionLabel: "Personal Information" },
  { fieldId: "employer", sectionId: "employment:0", sectionLabel: "Employment History" },
  { fieldId: "role", sectionId: "employment:0", sectionLabel: "Employment History" },
  { fieldId: "orphan" }
];

test("lists populated sections once in page order", () => {
  assert.deepEqual(availableSections(fields), [
    { id: "personal:0", label: "Personal Information" },
    { id: "employment:0", label: "Employment History" }
  ]);
});

test("keeps the whole page by default and filters a selected section", () => {
  assert.equal(fieldsInScope(fields).length, 4);
  assert.deepEqual(fieldsInScope(fields, "employment:0").map(field => field.fieldId), ["employer", "role"]);
});

test("keeps add-row actions inside the selected section", () => {
  const actions = [
    { actionId: "employment-add", sectionId: "employment:0" },
    { actionId: "education-add", sectionId: "education:0" }
  ];
  assert.deepEqual(actionsInScope(actions, "employment:0").map(action => action.actionId), ["employment-add"]);
  assert.equal(actionsInScope(actions).length, 2);
});
