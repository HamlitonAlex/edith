import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, runAgentTurn } from "../agent/index.js";
import { decideNextAction, diagnose } from "../agent/planner.js";
import { createKnownAgentState } from "./known-agent-fixture.js";

function report(t, name, result) {
  const action = result?.state?.next_recommended_action || result;
  const latestObservation = result?.state?.recent_events?.at(-1)?.text;
  t.diagnostic(JSON.stringify({
    scenario: name,
    observation: latestObservation || action?.observation || "无推荐，先提问",
    judgment: action?.judgment || result?.reply,
    next_step: action?.next_action || null,
    why_now: action?.why_now || null,
    ask_first: ["question", "reflection", "negotiate_direction"].includes(result?.kind),
    on_reject: action?.reconsider_if || "进入协商，不把拒绝算作失败",
  }, null, 2));
}

test("judgment: tired users are met without turning a current state into a direction", t => {
  const result = runAgentTurn(createAgentState(), "我今天很累，只想躺着", new Date("2026-09-14T10:00:00Z"));
  assert.equal(result.kind, "reflection");
  assert.equal(result.state.long_term_goals.length, 0);
  assert.equal(result.state.direction_signals?.rest_recovery, undefined);
  report(t, "用户突然很累", result);
});

test("judgment: three deferred steps identify friction before another recommendation", t => {
  const state = createKnownAgentState();
  state.action_history = [1, 2, 3].map(day => ({ outcome: "deferred", reason: "用户选择推迟", at: `2026-09-${10 + day}T10:00:00Z` }));
  const action = decideNextAction(state, diagnose(state));
  assert.match(action.observation, /推迟/);
  assert.equal(action.gap.id, "activation_friction");
  assert.ok(action.duration_minutes <= 8);
  assert.match(action.why_now, /连续三次/);
  report(t, "连续三天没完成建议", action);
});

test("judgment: repeated deferrals on one day do not masquerade as a three-day pattern", () => {
  const state = createKnownAgentState();
  state.action_history = [1, 2, 3].map(() => ({ outcome: "deferred", reason: "用户选择推迟", at: "2026-09-14T10:00:00Z" }));
  const action = decideNextAction(state, diagnose(state));
  assert.notEqual(action.gap.id, "activation_friction");
});

test("judgment: a new AI project becomes a repeated-direction signal before it reaches the path", t => {
  let state = createKnownAgentState();
  for (const day of [10, 11]) {
    state = runAgentTurn(state, "我突然有个 AI 产品想法，想做一个陪人学习的新项目", new Date(`2026-09-${day}T10:00:00Z`)).state;
  }
  const signal = state.direction_signals.ai_product;
  assert.equal(signal.occurrences, 2);
  assert.equal(signal.status, "repeated_signal");
  assert.equal(state.long_term_goals.some(goal => /AI 产品/.test(goal.text)), false);
  report(t, "用户突然想做新项目", state.next_recommended_action);
});

test("judgment: a direction repeated across three days becomes a path candidate without rewriting history", () => {
  let state = createKnownAgentState();
  for (const day of [10, 11, 12]) {
    state = runAgentTurn(state, "我又在想 AI 产品，想做一个陪人学习的新项目", new Date(`2026-09-${day}T10:00:00Z`)).state;
  }
  assert.equal(state.direction_signals.ai_product.status, "path_candidate");
  assert.equal(state.direction_signals.ai_product.unique_days.length, 3);
  assert.equal(state.long_term_goals.some(goal => /AI 产品/.test(goal.text)), false);
});

test("judgment: an imminent skills exam outranks product work and names the comparison", t => {
  const state = createKnownAgentState();
  state.long_term_goals = [
    { id: "product", text: "做出真正有人使用的 AI 产品", confidence: 0.9 },
    { id: "skills-exam", text: "通过技能高考", confidence: 0.9 },
  ];
  state.today_context = { available_minutes: 20 };
  const result = runAgentTurn(state, "技能高考还有两周就考试了，但我最近一直在做产品", new Date("2026-09-14T10:00:00Z"));
  const action = result.state.next_recommended_action;
  assert.match(action.observation, /技能高考/);
  assert.equal(action.related_direction.id, "skills-exam");
  assert.match(action.why_not_other_directions.join(" "), /AI 产品/);
  report(t, "技能高考临近但一直在做产品", action);
});

test("judgment: verified progress raises the next step from clarification to application", t => {
  const state = createKnownAgentState();
  state.skills.ai_application = { label: "AI 应用", level: "developing", confidence: 0.72, evidence: ["一次真实解释", "一次真实实践"] };
  const action = decideNextAction(state, diagnose(state));
  assert.match(action.observation, /真实证据/);
  assert.equal(action.gap.id, "apply_and_explain");
  assert.match(action.next_action.title, /应用|检验/);
  report(t, "用户完成得很好", action);
});

test("judgment: a path-conflicting direction is negotiated and recorded, not blindly adopted", t => {
  const proposed = runAgentTurn(createKnownAgentState(), "帮我判断下一步", new Date("2026-09-14T09:00:00Z"));
  const originalActionId = proposed.state.next_recommended_action.id;
  const result = runAgentTurn(proposed.state, "我想换个方向，技能高考临近，我不想继续做产品", new Date("2026-09-14T10:00:00Z"));
  assert.equal(result.kind, "negotiate_direction");
  assert.equal(result.state.next_recommended_action.id, originalActionId);
  assert.equal(result.state.direction_signals.skills_exam.occurrences, 1);
  report(t, "主动提出与当前路径冲突的新方向", result);
});

test("judgment: low-confidence diagnosis asks one focused question before proposing", t => {
  const state = createAgentState();
  state.long_term_goals = [{ id: "goal-explore", text: "探索 AI 产品", confidence: 0.8 }];
  const result = runAgentTurn(state, "帮我判断现在该学什么", new Date("2026-09-14T10:00:00Z"));
  assert.equal(result.kind, "question");
  assert.match(result.reply, /不太确定|先确认/);
  assert.equal(result.state.next_recommended_action, null);
  report(t, "信息不足时先提问", result);
});

test("judgment: every proposal exposes a complete evidence chain", () => {
  const result = runAgentTurn(createKnownAgentState(), "帮我判断下一步", new Date("2026-09-14T10:00:00Z"));
  const action = result.state.next_recommended_action;
  for (const field of ["observation", "current_context", "related_direction", "gap", "why_now", "next_action", "expected_gain", "confidence", "why_not_other_directions"]) {
    assert.ok(field in action, `missing ${field}`);
  }
  assert.equal(typeof action.current_context, "object");
  assert.equal(typeof action.related_direction, "object");
  assert.equal(typeof action.gap, "object");
  assert.equal(typeof action.next_action, "object");
  assert.ok(Array.isArray(action.why_not_other_directions));
});
