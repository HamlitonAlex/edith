import test from "node:test";
import assert from "node:assert/strict";
import { createAgentState, runAgentTurn } from "../agent/index.js";
import { createModelContext } from "../agent/model-gateway.js";
import { diagnose } from "../agent/planner.js";
import { deriveTutorFeedback } from "../agent/user-model.js";
import { createKnownAgentState } from "./known-agent-fixture.js";

const at = (minute = 0, day = "2026-09-15") => new Date(Date.parse(`${day}T10:00:00Z`) + minute * 60000);
const python = "接受，现在学习 Python 的 for 循环";
const english = "接受，练习英语表达：介绍我的项目";
const concreteMastery = "具体场景是列表筛选；我掌握了规则，能独立解释并写出自己的循环，下一次我会迁移到新场景。";
const weakEvidence = "我做完了，具体场景是列表筛选；我仍然说不清规则，最小行动是先写出输入。";

function knownState() {
  return createKnownAgentState(at());
}

function accept(state, text, minute) {
  const proposed = runAgentTurn(state, "帮我判断下一步", at(minute));
  return runAgentTurn(proposed.state, text, at(minute + 1));
}

function finishMastery(state, text, minute, completion = concreteMastery) {
  const started = accept(state, text, minute);
  return runAgentTurn(started.state, completion, at(minute + 2));
}

function finishEnglishMastery(state, minute) {
  const started = accept(state, english, minute);
  const repeatedError = runAgentTurn(started.state, "He go to school yesterday", at(minute + 2));
  return runAgentTurn(
    repeatedError.state,
    "具体场景是英语对话；我能独立解释 yesterday 要用过去式，也能写出 went，下一次我会复现。",
    at(minute + 3),
  );
}

function interrupt(state, text, minute) {
  const started = accept(state, text, minute);
  return runAgentTurn(started.state, "我决定取消，不学了", at(minute + 2));
}

function lowerAndFail(state, minute) {
  const started = accept(state, python, minute);
  const confusedOnce = runAgentTurn(started.state, "我还没懂", at(minute + 2));
  const confusedTwice = runAgentTurn(confusedOnce.state, "我还是不明白", at(minute + 3));
  return runAgentTurn(confusedTwice.state, weakEvidence, at(minute + 4));
}

function practiceMastery(state, minute) {
  const started = accept(state, python, minute);
  const practice = runAgentTurn(started.state, "例子我能看懂，但自己写不出来", at(minute + 2));
  return runAgentTurn(practice.state, concreteMastery, at(minute + 3));
}

test("one high-hint session is only a signal; two independent sessions change the next Tutor strategy", () => {
  let state = knownState();
  let result = accept(state, python, 0);
  result = runAgentTurn(result.state, "别问了，直接告诉我答案", at(2));
  result = runAgentTurn(result.state, "别问了，直接告诉我答案", at(3));
  assert.equal(deriveTutorFeedback(result.state).repeated_prompting, null);
  state = runAgentTurn(result.state, "我决定取消，不学了", at(4)).state;

  result = accept(state, python, 5);
  result = runAgentTurn(result.state, "别问了，直接告诉我答案", at(7));
  result = runAgentTurn(result.state, "别问了，直接告诉我答案", at(8));
  state = runAgentTurn(result.state, "我决定取消，不学了", at(9)).state;

  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.repeated_prompting.topic, "Python for 循环");
  assert.equal(feedback.repeated_prompting.count, 2);
  const next = accept(state, python, 11);
  assert.equal(next.state.tutor_session.difficulty, "lower");
  assert.equal(next.state.tutor_session.feedback_applied.includes("repeated_prompting"), true);
  assert.match(next.reply, /提示|小步|例子|不再继续/);
});

test("two independent rapid mastery sessions move the planner to transfer instead of repetition", () => {
  let state = knownState();
  state = finishMastery(state, python, 0).state;
  state = finishMastery(state, python, 5).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.rapid_mastery.topic, "Python for 循环");
  assert.equal(feedback.rapid_mastery.count, 2);
  const proposal = runAgentTurn(state, "帮我判断下一步", at(10));
  assert.equal(proposal.kind, "proposal");
  assert.equal(proposal.state.next_recommended_action.feedback_applied.includes("rapid_mastery"), true);
  assert.match(proposal.state.next_recommended_action.title, /迁移|新场景|应用/);
});

test("a repeated English error schedules light recurrence rather than silently moving on", () => {
  let state = knownState();
  state = finishEnglishMastery(state, 0).state;
  state = finishEnglishMastery(state, 5).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.recurring_english_error.error, "expression");
  assert.equal(feedback.recurring_english_error.count, 2);
  const proposal = runAgentTurn(state, "帮我判断下一步", at(10));
  assert.equal(proposal.state.next_recommended_action.feedback_applied.includes("recurring_english_error"), true);
  assert.match(proposal.state.next_recommended_action.title, /英语|复现|表达/);
});

test("two interrupted sessions change the next action to activation repair", () => {
  let state = knownState();
  state = interrupt(state, python, 0).state;
  state = interrupt(state, python, 5).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.interrupted_task.topic, "Python for 循环");
  assert.equal(feedback.interrupted_task.count, 2);
  const proposal = runAgentTurn(state, "帮我判断下一步", at(10));
  assert.equal(proposal.state.next_recommended_action.feedback_applied.includes("interrupted_task"), true);
  assert.match(proposal.state.next_recommended_action.title, /启动|小步|负担/);
});

test("two failed lower-difficulty sessions fall back to prerequisite diagnosis", () => {
  let state = knownState();
  state = lowerAndFail(state, 0).state;
  state = lowerAndFail(state, 8).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.lowered_failure.topic, "Python for 循环");
  assert.equal(feedback.lowered_failure.count, 2);
  const proposal = runAgentTurn(state, "帮我判断下一步", at(16));
  assert.equal(proposal.state.next_recommended_action.feedback_applied.includes("lowered_failure"), true);
  assert.match(proposal.state.next_recommended_action.title, /前置|基础|诊断/);
});

test("a stable domain shift is surfaced as a transition instead of being treated as noise", () => {
  let state = knownState();
  state = finishMastery(state, english, 0, weakEvidence).state;
  state = finishMastery(state, english, 5, weakEvidence).state;
  state = finishMastery(state, python, 10, weakEvidence).state;
  state = finishMastery(state, python, 15, weakEvidence).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.domain_shift.from, "english");
  assert.equal(feedback.domain_shift.to, "computer");
  const diagnosis = diagnose(state);
  assert.equal(diagnosis.tutor_feedback.domain_shift.to, "computer");
  const proposal = runAgentTurn(state, "帮我判断下一步", at(20));
  assert.equal(proposal.state.next_recommended_action.feedback_applied.includes("domain_shift"), true);
  assert.match(proposal.state.next_recommended_action.title, /方向|领域|确认/);
});

test("two successful practice sessions make practice the preferred Tutor form", () => {
  let state = knownState();
  state = practiceMastery(state, 0).state;
  state = practiceMastery(state, 5).state;
  const feedback = deriveTutorFeedback(state);
  assert.equal(feedback.preferred_teaching_style.stage, "practice");
  assert.equal(feedback.preferred_teaching_style.count, 2);
  const next = accept(state, python, 10);
  assert.equal(next.state.tutor_session.teaching_style, "practice");
  assert.equal(next.state.tutor_session.feedback_applied.includes("preferred_teaching_style"), true);
  assert.match(next.reply, /写|骨架|练习/);
});

test("feedback is visible to planner and model context as derived evidence, without a second memory store", () => {
  let state = knownState();
  state = interrupt(state, python, 0).state;
  state = interrupt(state, python, 5).state;
  const context = createModelContext(state, "下一步");
  assert.ok(context.tutor_feedback.interrupted_task);
  assert.equal(Object.hasOwn(context, "tutor_feedback_store"), false);
  assert.equal(Object.hasOwn(context.tutor_feedback.interrupted_task, "evidence"), false);
});
