import test from "node:test";
import assert from "node:assert/strict";
import "../src/field-label.js";

const { chooseFieldLabel, meaningful, withoutOptions } = globalThis.OpenFormFillerLabels;

test("uses nearby question context instead of an internal textarea name", () => {
  assert.equal(chooseFieldLabel({
    ancestorCandidates: ["", "Have you been directly involved with cloud-based agent runtime solutions?"],
    fallback: "q9329418_1_text"
  }), "Have you been directly involved with cloud-based agent runtime solutions?");
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
