import test from "node:test";
import assert from "node:assert/strict";
import { actionIndicatorFor, COMPLETION_BADGE_DURATION_MS } from "../src/action-indicator.js";

test("running operations remain visible on the extension icon", () => {
  assert.deepEqual(actionIndicatorFor({ status: "running", message: "Preparing answers…" }), {
    text: "RUN",
    color: "#7c3aed",
    title: "OYB is running — Preparing answers…"
  });
});

test("terminal and resumable states have distinct indicators", () => {
  const now = 10_000;
  assert.equal(actionIndicatorFor({ status: "complete", updatedAt: now }, now).text, "✓");
  assert.equal(actionIndicatorFor({ status: "paused" }).text, "Ⅱ");
  assert.equal(actionIndicatorFor({ status: "failed" }).text, "!");
  assert.equal(actionIndicatorFor({ status: "canceled" }).text, "");
  assert.equal(actionIndicatorFor(null).text, "");
});

test("completed indicators clear after acknowledgement or a short timeout", () => {
  const completedAt = 10_000;
  assert.equal(actionIndicatorFor({ status: "complete", updatedAt: completedAt, completionBadgeAcknowledged: true }, completedAt).text, "");
  assert.equal(actionIndicatorFor({ status: "complete", updatedAt: completedAt }, completedAt + COMPLETION_BADGE_DURATION_MS).text, "");
});
