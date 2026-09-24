import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, hydrateAgentState, runAgentTurn } from "../agent/index.js";
import { createModelContext } from "../agent/model-gateway.js";
import { createKnownAgentState } from "./known-agent-fixture.js";

const at = (minute = 0, day = "2026-09-15") => new Date(`${day}T10:${String(minute).padStart(2, "0")}:00Z`);

function proposal() {
  return runAgentTurn(createKnownAgentState(at()), "帮我判断下一步", at());
}

function start(text = "接受，现在学习 Python 的 for 循环", minute = 1) {
  const proposed = proposal();
  return runAgentTurn(proposed.state, text, at(minute));
}

test("a fresh state has local Tutor observability without exposing a UI", () => {
  const state = createAgentState(at());
  assert.deepEqual(state.tutor_metrics.history, []);
  assert.equal(state.tutor_metrics.current, null);
  assert.deepEqual(state.tutor_metrics.totals, {
    started: 0,
    completed: 0,
    interrupted: 0,
    verification_attempts: 0,
    total_turns: 0,
    total_hints: 0,
    total_adaptations: 0,
  });
});

test("accepting a Tutor step opens a compact local session record", () => {
  const result = start();
  const current = result.state.tutor_metrics.current;
  assert.ok(current.id);
  assert.equal(current.action_id, result.state.next_recommended_action.id);
  assert.equal(current.domain, "computer");
  assert.equal(current.status, "active");
  assert.equal(current.turn_count, 0);
  assert.equal(result.state.tutor_metrics.totals.started, 1);
});

test("Tutor turns record effort, hints, and adaptations without storing raw transcripts", () => {
  let result = start();
  result = runAgentTurn(result.state, "我还没懂", at(2));
  result = runAgentTurn(result.state, "别问了，直接告诉我答案", at(3));
  const current = result.state.tutor_metrics.current;
  assert.equal(current.turn_count, 2);
  assert.equal(current.hints_used, 1);
  assert.equal(current.adaptations, 1);
  assert.equal(Object.hasOwn(current, "turns"), false);
  assert.equal(Object.hasOwn(current, "evidence"), false);
});

test("a premature finished message creates a verification attempt, not a false completion", () => {
  const result = runAgentTurn(start().state, "我学完了", at(4));
  const current = result.state.tutor_metrics.current;
  assert.equal(result.verified, false);
  assert.ok(current);
  assert.equal(current.status, "active");
  assert.equal(current.turn_count, 1);
  assert.equal(current.verification_attempts, 1);
  assert.equal(result.state.tutor_metrics.totals.verification_attempts, 1);
  assert.equal(result.state.learning_results.length, 0);
});

test("verified mastery closes the session with a useful, bounded summary", () => {
  const result = runAgentTurn(
    start().state,
    "具体场景是列表筛选；我掌握了 range 的右边界规则，能独立解释并写出自己的循环，下一次我会迁移到列表筛选。",
    at(9),
  );
  const summary = result.state.tutor_metrics.history.at(-1);
  assert.equal(result.verified, true);
  assert.equal(result.state.tutor_metrics.current, null);
  assert.equal(summary.status, "mastered");
  assert.equal(summary.domain, "computer");
  assert.equal(summary.duration_minutes, 8);
  assert.equal(summary.turn_count, 1);
  assert.ok(summary.result_id);
  assert.equal(result.state.tutor_metrics.totals.completed, 1);
  assert.equal(result.state.tutor_metrics.totals.total_turns, 1);
});

test("a clear Tutor rejection closes as interrupted and preserves the reason", () => {
  const result = runAgentTurn(start().state, "我决定取消，不学了", at(3));
  const summary = result.state.tutor_metrics.history.at(-1);
  assert.equal(result.kind, "revision");
  assert.equal(result.state.tutor_session, null);
  assert.equal(summary.status, "interrupted");
  assert.match(summary.reason, /取消|不学/);
  assert.equal(result.state.tutor_metrics.totals.interrupted, 1);
  assert.equal(result.state.learning_results.length, 0);
});

test("model context receives summaries and never raw Tutor turns", () => {
  const result = runAgentTurn(
    start().state,
    "具体场景是列表筛选；我掌握了 range 的右边界规则，能独立解释并写出自己的循环。",
    at(6),
  );
  const context = createModelContext(result.state, "下一步");
  assert.equal(context.tutor_metrics.current, null);
  assert.equal(context.tutor_metrics.recent_sessions.length, 1);
  assert.equal(Object.hasOwn(context.tutor_metrics.recent_sessions[0], "turns"), false);
  assert.equal(Object.hasOwn(context.tutor_metrics.recent_sessions[0], "evidence"), false);
  assert.equal(context.tutor_metrics.totals.completed, 1);
});

test("session history stays bounded for long-term local use", () => {
  let state = createKnownAgentState(at());
  for (let index = 0; index < 35; index += 1) {
    const proposed = runAgentTurn(state, "帮我判断下一步", at(index % 50));
    const accepted = runAgentTurn(proposed.state, "接受，现在学习 Python 的 for 循环", at((index % 50) + 1));
    state = runAgentTurn(accepted.state, "我决定取消，不学了", at((index % 50) + 2)).state;
  }
  assert.ok(state.tutor_metrics.history.length <= 30);
});

test("hydration keeps Tutor summaries while trimming stale history", () => {
  const saved = createAgentState(at());
  saved.tutor_metrics.history = Array.from({ length: 35 }, (_, index) => ({ id: `session-${index}` }));
  saved.tutor_metrics.totals.started = 35;
  const hydrated = hydrateAgentState(saved);
  assert.equal(hydrated.tutor_metrics.history.length, 30);
  assert.equal(hydrated.tutor_metrics.history[0].id, "session-5");
  assert.equal(hydrated.tutor_metrics.totals.started, 35);
});
