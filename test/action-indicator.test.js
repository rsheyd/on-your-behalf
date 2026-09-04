import test from "node:test";
import assert from "node:assert/strict";
import { actionIndicatorFor } from "../src/action-indicator.js";

test("running operations remain visible on the extension icon", () => {
  assert.deepEqual(actionIndicatorFor({ status: "running", message: "Preparing answers…" }), {
    text: "RUN",
    color: "#7c3aed",
    title: "OYB is running — Preparing answers…"
  });
});

test("terminal and resumable states have distinct indicators", () => {
  assert.equal(actionIndicatorFor({ status: "complete" }).text, "✓");
  assert.equal(actionIndicatorFor({ status: "paused" }).text, "Ⅱ");
  assert.equal(actionIndicatorFor({ status: "failed" }).text, "!");
  assert.equal(actionIndicatorFor({ status: "canceled" }).text, "");
  assert.equal(actionIndicatorFor(null).text, "");
});
