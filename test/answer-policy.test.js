import test from "node:test";
import assert from "node:assert/strict";
import { buildAnsweringPolicy } from "../src/answer-policy.js";

test("keeps the default policy compact and source-rich", () => {
  const policy = buildAnsweringPolicy();
  assert.match(policy, /all enabled user sources together/i);
  assert.match(policy, /concrete relevant details/i);
  assert.match(policy, /strongest answer supported by those sources/i);
  assert.doesNotMatch(policy, /select the affirmative option/i);
  assert.doesNotMatch(policy, /most likely answer/i);
});

test("adds affirmative and ordinary assumption choices only when enabled", () => {
  const policy = buildAnsweringPolicy({ assumeAffirmative: true, allowAssumptions: true });
  assert.match(policy, /select the affirmative option and mark it chosen/i);
  assert.match(policy, /select the most likely answer and mark it inferred/i);
  assert.match(policy, /Do not infer criminal or legal history/i);
});

test("the nested option permits consequential assumptions", () => {
  const policy = buildAnsweringPolicy({ allowAssumptions: true, includeConsequentialAssumptions: true });
  assert.doesNotMatch(policy, /Do not infer criminal or legal history/i);
});
