import test from "node:test";
import assert from "node:assert/strict";
import "../src/field-label.js";

const { chooseFieldLabel, chooseIndexedFieldLabel, chooseInstructionHint, genericIndexedRole, meaningful, withoutOptions } = globalThis.OpenFormFillerLabels;

test("uses nearby question context instead of an internal textarea name", () => {
  assert.equal(chooseFieldLabel({
    ancestorCandidates: ["", "Have you been directly involved with cloud-based agent runtime solutions?"],
    fallback: "q9329418_1_text"
  }), "Have you been directly involved with cloud-based agent runtime solutions?");
});

test("keeps parent question context for generic indexed explanation roles", () => {
  assert.equal(genericIndexedRole("q9587168 explain"), true);
  assert.equal(chooseIndexedFieldLabel({
    nearbyLabel: "Did your company use Slack or Gchat? Yes No",
    semanticHint: "q9587168 explain"
  }), "Did your company use Slack or Gchat? Yes No");
});

test("keeps meaningful repeated-field roles concise", () => {
  assert.equal(genericIndexedRole("employment job title"), false);
  assert.equal(chooseIndexedFieldLabel({
    nearbyLabel: "Employment history Company Job title Start date",
    semanticHint: "employment job title"
  }), "employment job title");
});

test("rejects radio containers that contain only option labels", () => {
  assert.equal(chooseFieldLabel({
    primaryCandidates: ["Yes"],
    ancestorCandidates: ["Yes No", "Do you consent to this call being recorded? Yes No"],
    optionLabels: ["Yes", "No"],
    fallback: "AcceptRecordingConsent"
  }), "Do you consent to this call being recorded? Yes No");
});

test("select context does not need to contain its option list", () => {
  assert.equal(chooseFieldLabel({ ancestorCandidates: ["Select your Time Zone:"], fallback: "timezone" }), "Select your Time Zone:");
});

test("option-only text is not meaningful group context", () => {
  assert.equal(withoutOptions("I agree I do not agree", ["I agree", "I do not agree"]), "");
  assert.equal(meaningful("I agree I do not agree", ["I agree", "I do not agree"]), false);
});

test("extracts a shared formatting instruction without neighboring field labels", () => {
  assert.equal(chooseInstructionHint([
    "Research Interests",
    "Please provide keywords across the categories below. Please use commas to separate items. Drugs & Technology Research Interests Board Certifications"
  ]), "Please provide keywords across the categories below. Please use commas to separate items.");
});
