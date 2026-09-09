import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, runAgentTurn } from "../agent/index.js";

test("proposes exactly one evidence-backed next action with why now", () => {
  const result = runAgentTurn(createAgentState(), "我今天想学点东西");
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
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我今天很累");
  assert.equal(result.kind, "negotiation");
  assert.match(result.reply, /A\./);
  assert.match(result.reply, /B\./);
  assert.match(result.reply, /C\./);
  assert.match(result.reply, /最终由你选/);
});

test("asking why connects the resource to this user's long-term goal", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我为什么要看这个？");
  assert.equal(result.kind, "explanation");
  assert.match(result.reply, /未来想做产品/);
  assert.match(result.reply, /技术如何改变社会结构/);
});

test("completion without explanation is not treated as mastery", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我看完了");
  assert.equal(result.verified, false);
  assert.match(result.reply, /还缺少理解证据/);
  assert.equal(result.state.skills.general_knowledge.evidence.length, 0);
});

test("explanation evidence updates skill model and clears the action", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我看完了。收益是粮食更加稳定，代价是劳动和疾病增加，而且社会关系开始围绕土地和权力重组。");
  assert.equal(result.verified, true);
  assert.equal(result.state.next_recommended_action, null);
  assert.equal(result.state.skills.general_knowledge.evidence.length, 1);
  assert.equal(result.state.recent_learning.length, 1);
});

test("a negotiated shorter action keeps revision evidence", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "那就缩成10分钟");
  assert.equal(result.state.next_recommended_action.duration_minutes, 10);
  assert.equal(result.state.action_history.length, 1);
  assert.match(result.state.action_history[0].reason, /协商缩短/);
});

test("the guide can challenge a rejection while preserving user authority", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "不要这个，没必要");
  assert.equal(result.kind, "challenge");
  assert.match(result.reply, /暂时不同意/);
  assert.match(result.reply, /我也可能判断错/);
  assert.match(result.reply, /最终决定仍然是你的/);
});

test("a clear final rejection overrides the guide's disagreement", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我决定取消，最终不做");
  assert.equal(result.kind, "revision");
  assert.equal(result.state.next_recommended_action, null);
  assert.equal(result.state.action_history.at(-1).outcome, "rejected");
  assert.match(result.reply, /尊重你的最终决定/);
});

test("completion evidence takes priority over incidental acceptance words", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const result = runAgentTurn(proposed.state, "我看完了，可以确认：收益是粮食稳定，代价是疾病增加，社会关系也围绕土地权力重组。");
  assert.equal(result.verified, true);
  assert.equal(result.state.next_recommended_action, null);
});

test("Tutor Mode evaluates a user's explanation without requiring a completion command", () => {
  const proposed = runAgentTurn(createAgentState(), "给我判断下一步");
  const started = runAgentTurn(proposed.state, "接受，现在开始");
  const result = runAgentTurn(started.state, "收益是粮食更稳定，代价是疾病和劳动增加，社会关系开始被土地和权力重新组织。");
  assert.equal(result.verified, true);
  assert.equal(result.state.tutor_session, null);
});
