import test from "node:test";
import assert from "node:assert/strict";

import { adoptAdjustment, rejectAdjustment } from "../lib/plan-state.js";

const plan = {
  version: 2,
  currentActions: ["周二练习 40 分钟", "周四练习 40 分钟"],
  history: [],
};

const adjustment = {
  id: "adjustment-time",
  reason: "本周可用时间从 120 分钟降至 30 分钟",
  replaceActions: ["周六完成一次 25 分钟的数据检查"],
  retained: ["保留独立整理数据的目标"],
};

test("adopting an adjustment creates a new immutable plan version", () => {
  const next = adoptAdjustment(plan, adjustment, "2026-09-05T20:00:00+08:00");

  assert.equal(next.version, 3);
  assert.deepEqual(next.currentActions, adjustment.replaceActions);
  assert.deepEqual(next.history[0], {
    adjustment_id: "adjustment-time",
    decision: "adopted",
    reason: adjustment.reason,
    changed_actions: adjustment.replaceActions,
    decided_at: "2026-09-05T20:00:00+08:00",
  });
  assert.equal(plan.version, 2);
  assert.deepEqual(plan.history, []);
});

test("rejecting an adjustment records the decision without changing actions or version", () => {
  const next = rejectAdjustment(plan, adjustment, "2026-09-05T20:00:00+08:00");

  assert.equal(next.version, 2);
  assert.deepEqual(next.currentActions, plan.currentActions);
  assert.equal(next.history[0].decision, "rejected");
  assert.equal(plan.history.length, 0);
});

test("plan transitions reject incomplete adjustments", () => {
  assert.throws(
    () => adoptAdjustment(plan, { id: "bad" }),
    /Adjustment requires id, reason, and replaceActions/,
  );
});
