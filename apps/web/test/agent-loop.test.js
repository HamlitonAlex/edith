import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, runAgentTurn } from "../agent/index.js";
import { createKnownAgentState } from "./known-agent-fixture.js";

test("a new user profile starts unknown instead of inheriting the developer's goals", () => {
  const state = createAgentState(new Date("2026-09-10T08:00:00Z"));
  assert.equal(state.current_stage, "");
  assert.deepEqual(state.long_term_goals, []);
  assert.deepEqual(state.active_goals, []);
});

test("ordinary interaction is retained as local learning evidence", () => {
  const result = runAgentTurn(createAgentState(), "我看视频更喜欢不倍速，边看边想", new Date("2026-09-10T08:00:00Z"));
  assert.equal(result.state.memory.at(-1).status, "observed");
  assert.match(result.state.memory.at(-1).text, /不倍速/);
});

test("a possible life direction is confirmed before becoming a long-term goal", () => {
  const first = runAgentTurn(createAgentState(), "我希望以后能独立做出真正有人用的产品");
  assert.equal(first.kind, "confirmation");
  assert.equal(first.state.long_term_goals.length, 0);
  assert.equal(first.state.pending_items[0].kind, "long_term_goal_inference");
  const confirmed = runAgentTurn(first.state, "对，这就是我现在最想走的方向");
  assert.equal(confirmed.state.long_term_goals.length, 1);
  assert.match(confirmed.state.long_term_goals[0].text, /独立做出/);
  const proposed = runAgentTurn(confirmed.state, "我现在有20分钟，帮我判断下一步");
  assert.match(proposed.state.next_recommended_action.title, /真正有人用的产品/);
  assert.doesNotMatch(proposed.state.next_recommended_action.title, /农业革命/);
});

test("proposes exactly one evidence-backed next action with why now", () => {
  const result = runAgentTurn(createKnownAgentState(), "我今天想学点东西");
  assert.equal(result.kind, "proposal");
  assert.ok(result.state.next_recommended_action);
  assert.match(result.reply, /下一件事/);
  assert.match(result.reply, /为什么现在值得做/);
  assert.match(result.reply, /完成标准/);
  assert.match(result.reply, /我的判断/);
  assert.match(result.reply, /我的保留意见/);
  assert.match(result.reply, /把握：/);
  assert.equal(result.state.decision_log.length, 1);
});

test("low energy triggers negotiation rather than cancellation or blind compliance", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我今天很累");
  assert.equal(result.kind, "negotiation");
  assert.match(result.reply, /A\./);
  assert.match(result.reply, /B\./);
  assert.match(result.reply, /C\./);
  assert.match(result.reply, /最终由你选/);
});

test("asking why connects the action to this user's long-term goal", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我为什么要看这个？");
  assert.equal(result.kind, "explanation");
  assert.match(result.reply, /建立稳定而自主的学习节奏/);
  assert.match(result.reply, /不是套用一份固定清单/);
});

test("completion without explanation is not treated as mastery", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我看完了");
  assert.equal(result.verified, false);
  assert.match(result.reply, /还缺少理解证据/);
  assert.equal(Object.values(result.state.skills).flatMap(skill => skill.evidence).length, 0);
});

test("explanation evidence updates skill model and clears the action", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我找到了具体场景：晚饭后先读十分钟，观察自己是否更容易开始；最小行动是今晚先试一次。");
  assert.equal(result.verified, true);
  assert.equal(result.state.next_recommended_action, null);
  assert.equal(Object.values(result.state.skills).flatMap(skill => skill.evidence).length, 1);
  assert.equal(result.state.recent_learning.length, 1);
});

test("a negotiated shorter action keeps revision evidence", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "那就缩成10分钟");
  assert.equal(result.state.next_recommended_action.duration_minutes, 10);
  assert.equal(result.state.action_history.length, 1);
  assert.match(result.state.action_history[0].reason, /协商缩短/);
});

test("the guide can challenge a rejection while preserving user authority", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "不要这个，没必要");
  assert.equal(result.kind, "challenge");
  assert.match(result.reply, /暂时不同意/);
  assert.match(result.reply, /我也可能判断错/);
  assert.match(result.reply, /最终决定仍然是你的/);
});

test("a clear final rejection overrides the guide's disagreement", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我决定取消，最终不做");
  assert.equal(result.kind, "revision");
  assert.equal(result.state.next_recommended_action, null);
  assert.equal(result.state.action_history.at(-1).outcome, "rejected");
  assert.match(result.reply, /尊重你的最终决定/);
});

test("completion evidence takes priority over incidental acceptance words", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我做完了，可以确认：具体场景是晚饭后，变化是更容易开始，下一次最小行动是继续十分钟。");
  assert.equal(result.verified, true);
  assert.equal(result.state.next_recommended_action, null);
});

test("Tutor Mode evaluates a user's explanation without requiring a completion command", () => {
  const proposed = runAgentTurn(createKnownAgentState(), "给我判断下一步");
  const started = runAgentTurn(proposed.state, "接受，现在开始");
  const result = runAgentTurn(started.state, "具体场景是晚饭后，变化是我更容易开始，最小行动是明天继续读十分钟。");
  assert.equal(result.verified, true);
  assert.equal(result.state.tutor_session, null);
});
