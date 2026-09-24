import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAgentState, runAgentTurn } from "../agent/index.js";
import { createKnownAgentState } from "./known-agent-fixture.js";
import { decideNextAction, diagnose } from "../agent/planner.js";

const [iphoneHtml, iphoneJs] = await Promise.all([
  readFile(new URL("../iphone.html", import.meta.url), "utf8"),
  readFile(new URL("../iphone.js", import.meta.url), "utf8"),
]);

const at = (day = "2026-09-15") => new Date(`${day}T10:00:00Z`);

function proposed(day = "2026-09-15") {
  return runAgentTurn(createKnownAgentState(), "帮我判断下一步", at(day));
}

function frictionState(previousProposals = 0) {
  const state = createKnownAgentState();
  state.action_history = [10, 11, 12].map(day => ({
    outcome: "deferred",
    reason: "用户选择推迟",
    at: `2026-09-${day}T10:00:00Z`,
  }));
  state.decision_log = Array.from({ length: previousProposals }, (_, index) => ({
    decision: "propose",
    gap_id: "activation_friction",
    action_id: `previous-${index}`,
    title: `旧的启动建议 ${index}`,
  }));
  return state;
}

test("trust 01: mobile proposal exposes a short default summary", () => {
  const result = proposed();
  assert.equal(result.kind, "proposal");
  assert.match(result.summary_reply, /^下一步：/);
  assert.match(result.summary_reply, /为什么现在：/);
  assert.match(result.summary_reply, /预计用时：\s*\d+ 分钟/);
  assert.doesNotMatch(result.summary_reply, /观察到|关联方向|为什么不是|置信度|完成标准/);
});

test("trust 02: the first repeated friction proposal keeps the judgment but changes the form", () => {
  const first = decideNextAction(frictionState(0), diagnose(frictionState(0)));
  const second = decideNextAction(frictionState(1), diagnose(frictionState(1)));
  assert.equal(first.gap.id, "activation_friction");
  assert.equal(second.gap.id, "activation_friction");
  assert.notEqual(second.title, first.title);
  assert.notEqual(second.instructions, first.instructions);
});

test("trust 03: a third repeated friction proposal does not become a copy-paste nag", () => {
  const second = decideNextAction(frictionState(1), diagnose(frictionState(1)));
  const third = decideNextAction(frictionState(2), diagnose(frictionState(2)));
  assert.notEqual(third.title, second.title);
  assert.notEqual(third.instructions, second.instructions);
});

test("trust 04: low confidence stays a single focused question", () => {
  const state = createAgentState();
  state.long_term_goals = [{ id: "goal", text: "探索 AI 产品", confidence: 0.8 }];
  const result = runAgentTurn(state, "我还没想好", at());
  assert.equal(result.kind, "question");
  assert.match(result.reply, /一件事/);
  assert.doesNotMatch(result.reply, /下一步：|预计用时/);
});

test("trust 05: a plain refusal confirms the reason without control language", () => {
  const first = proposed();
  const result = runAgentTurn(first.state, "不想做", at("2026-09-16"));
  assert.equal(result.kind, "challenge");
  assert.equal(result.state.next_recommended_action.id, first.state.next_recommended_action.id);
  assert.match(result.reply, /原因|状态|任务太大|方向|判断/);
  assert.match(result.reply, /缩短|换|推迟|坚持/);
  assert.doesNotMatch(result.reply, /你必须|坚持就是进步|不要忘记你的长期目标|暂时不同意/);
});

test("trust 06: not wanting this study topic offers a lower-cost alternative", () => {
  const first = proposed();
  const result = runAgentTurn(first.state, "今天不想学这个", at("2026-09-16"));
  assert.equal(result.kind, "challenge");
  assert.equal(result.state.next_recommended_action.id, first.state.next_recommended_action.id);
  assert.match(result.reply, /缩短|换方式|推迟|换方向/);
});

test("trust 07: wanting something else starts a negotiation without silently replacing the path", () => {
  const first = proposed();
  const result = runAgentTurn(first.state, "我想做别的", at("2026-09-16"));
  assert.equal(result.kind, "negotiate_direction");
  assert.equal(result.state.next_recommended_action.id, first.state.next_recommended_action.id);
  assert.match(result.reply, /今天|这件事|长期方向/);
  assert.match(result.reply, /你可以|由你决定|坚持/);
});

test("trust 08: a final rejection is accepted without guilt", () => {
  const first = proposed();
  const result = runAgentTurn(first.state, "我决定取消，最终不做", at("2026-09-16"));
  assert.equal(result.kind, "revision");
  assert.equal(result.state.next_recommended_action, null);
  assert.match(result.reply, /尊重你的最终决定/);
  assert.doesNotMatch(result.reply, /你必须|坚持就是进步/);
});

test("trust 09: casual sharing is heard without generating a next step", () => {
  const active = proposed();
  const result = runAgentTurn(active.state, "今天下雨，窗外的声音很舒服", at());
  assert.equal(result.kind, "listening");
  assert.equal(result.state.next_recommended_action.id, active.state.next_recommended_action.id);
  assert.match(result.reply, /听到|继续说|先不用/);
});

test("trust 10: an explicit discussion request stays a discussion", () => {
  const result = runAgentTurn(createKnownAgentState(), "我想聊聊最近这个 AI 产品项目", at());
  assert.equal(result.kind, "discussion");
  assert.equal(result.state.next_recommended_action, null);
  assert.doesNotMatch(result.reply, /下一步|预计用时|必须/);
});

test("trust 10b: discussion does not erase an action that is still waiting", () => {
  const active = proposed();
  const result = runAgentTurn(active.state, "我想聊聊最近这个 AI 产品项目", at());
  assert.equal(result.kind, "discussion");
  assert.equal(result.state.next_recommended_action.id, active.state.next_recommended_action.id);
  assert.doesNotMatch(result.reply, /下一步：|预计用时/);
});

test("trust 11: an explicit action request still earns a proposal", () => {
  const result = runAgentTurn(createKnownAgentState(), "我今天想学点东西", at());
  assert.equal(result.kind, "proposal");
  assert.ok(result.state.next_recommended_action);
  assert.match(result.summary_reply, /^下一步：/);
});

test("trust 12: repeated unfinished work names multiple possible causes instead of blaming execution", () => {
  const state = frictionState();
  const action = decideNextAction(state, diagnose(state));
  assert.match(action.instructions, /任务太大|时间安排|不认可.*方向|临时状态|判断错误/);
  assert.doesNotMatch(`${action.judgment} ${action.why_now}`, /执行力差|懒|意志力/);
});

test("trust 13: a transient tired report is met as listening, not converted into a goal", () => {
  const result = runAgentTurn(createAgentState(), "我今天很累，只想吐槽一下", at());
  assert.equal(result.kind, "reflection");
  assert.equal(result.state.long_term_goals.length, 0);
  assert.equal(result.state.next_recommended_action, null);
});

test("trust 14: the why disclosure contains the full evidence chain while the card stays compact", () => {
  assert.match(iphoneHtml, /<summary>为什么<\/summary>/);
  assert.match(iphoneHtml, /data-proposal-observation/);
  assert.match(iphoneHtml, /data-proposal-confidence/);
  assert.match(iphoneHtml, /data-proposal-alternatives/);
  assert.match(iphoneJs, /summary_reply/);
  assert.match(iphoneJs, /proposal-observation/);
});

test("trust 15: a completed skill earns a more useful challenge instead of another basic explanation", () => {
  const result = proposed();
  result.state.skills.ai_application = {
    label: "AI 应用",
    level: "developing",
    confidence: 0.8,
    evidence: ["一次真实解释", "一次真实实践"],
  };
  const next = runAgentTurn(result.state, "帮我判断下一步，我又想继续看看", at("2026-09-16"));
  assert.equal(next.kind, "proposal");
  assert.equal(next.state.next_recommended_action.gap.id, "apply_and_explain");
  assert.match(next.state.next_recommended_action.title, /迁移|新场景|解释/);
});

function visibleReply(result) {
  return result.kind === "proposal" ? (result.summary_reply || result.reply) : result.reply;
}

function reviewTrust(result) {
  const reply = visibleReply(result);
  const lineCount = reply.split("\n").length;
  return {
    annoyance: reply.length <= 180 ? "低" : reply.length <= 320 ? "中" : "高",
    verbosity: lineCount <= 6 ? "短" : lineCount <= 12 ? "中" : "长",
    control: /你必须|坚持就是进步|不要忘记你的长期目标/.test(reply) ? "有" : "无",
    respect: /最终决定|你可以|我听到|不把.*失败|先不急/.test(reply) ? "高" : "中",
    willingness: /继续说|聊|你可以|先确认|你说了算|由你/.test(reply) ? "高" : "中",
    reply_length: reply.length,
  };
}

test("trust matrix: fifteen interactions are reviewed for friction, verbosity, control, respect and willingness", t => {
  const known = createKnownAgentState();
  const first = proposed();
  const lowConfidence = createAgentState();
  lowConfidence.long_term_goals = [{ id: "goal", text: "探索 AI 产品", confidence: 0.8 }];
  const examState = createKnownAgentState();
  examState.long_term_goals = [
    { id: "product", text: "做出真正有人使用的 AI 产品", confidence: 0.9 },
    { id: "skills-exam", text: "通过技能高考", confidence: 0.9 },
  ];
  examState.today_context = { available_minutes: 20 };
  const completedState = proposed().state;
  completedState.skills.ai_application = { label: "AI 应用", level: "developing", confidence: 0.8, evidence: ["一次真实解释", "一次真实实践"] };
  const scenarios = [
    ["首次推荐", first],
    ["启动阻力第 1 次", runAgentTurn(frictionState(0), "帮我判断下一步", at())],
    ["启动阻力第 2 次", runAgentTurn(frictionState(1), "帮我判断下一步", at())],
    ["低置信度提问", runAgentTurn(lowConfidence, "我还没想好", at())],
    ["普通拒绝", runAgentTurn(first.state, "不想做", at("2026-09-16"))],
    ["不想学这个", runAgentTurn(first.state, "今天不想学这个", at("2026-09-16"))],
    ["想做别的", runAgentTurn(first.state, "我想做别的", at("2026-09-16"))],
    ["最终拒绝", runAgentTurn(first.state, "我决定取消，最终不做", at("2026-09-16"))],
    ["生活分享", runAgentTurn(known, "今天下雨，窗外的声音很舒服", at())],
    ["主动讨论", runAgentTurn(known, "我想聊聊最近这个项目", at())],
    ["明确要行动", runAgentTurn(known, "我今天想学点东西", at())],
    ["连续未完成", runAgentTurn(frictionState(), "帮我判断下一步", at())],
    ["临时疲惫", runAgentTurn(createAgentState(), "我今天很累，只想吐槽一下", at())],
    ["完成后加难", runAgentTurn(completedState, "帮我判断下一步，我又想继续看看", at("2026-09-16"))],
    ["考试窗口", runAgentTurn(examState, "技能高考还有两周就考试了，但我最近一直在做产品", at())],
  ];
  assert.equal(scenarios.length, 15);
  const reviews = scenarios.map(([scenario, result]) => ({ scenario, kind: result.kind, review: reviewTrust(result) }));
  for (const { scenario, review } of reviews) {
    assert.notEqual(review.annoyance, "高", `${scenario} should not feel nagging`);
    assert.notEqual(review.verbosity, "长", `${scenario} should not be verbose by default`);
    assert.equal(review.control, "无", `${scenario} should not control the user`);
    assert.ok(["中", "高"].includes(review.respect), `${scenario} should respect the user`);
    assert.ok(["中", "高"].includes(review.willingness), `${scenario} should leave room to continue`);
  }
  t.diagnostic(JSON.stringify({ dimensions: ["烦人度", "啰嗦度", "控制感", "尊重", "继续聊"], scenarios: reviews }, null, 2));
});
