import test from "node:test";
import assert from "node:assert/strict";
import { createKnownAgentState } from "./known-agent-fixture.js";
import { observe } from "../agent/observer.js";
import { rememberObservation } from "../agent/memory.js";
import { addSkillEvidence, updateUserModel } from "../agent/user-model.js";
import { decideNextAction, diagnose, formatProposal } from "../agent/planner.js";

const DAYS = [
  { date: "2026-09-08", minutes: 20, mood: "专注", arrangement: "下午去学校拍摄", interest: "第一次对 AI 产品交互产生兴趣", unfinished: "产品原型还没整理", deferred: true, learning: "完成网络基础练习，能解释 TCP 和 UDP 的差异" },
  { date: "2026-09-09", minutes: null, mood: "稳定", arrangement: "临时有事要参加家庭聚餐", interest: "又想研究 AI 产品", unfinished: "产品原型仍未整理", deferred: true, learning: "完成一个网络真实场景解释" },
  { date: "2026-09-10", minutes: 8, mood: "疲惫", arrangement: "晚上加班", interest: "开始对语音学习工具感兴趣", unfinished: "网络复习没有完成", deferred: true, learning: "完成一次产品对话流小改动" },
  { date: "2026-09-11", minutes: 20, mood: "焦虑", arrangement: "学校通知技能高考还有两周", interest: "仍然想做 AI 产品", unfinished: "产品测试还剩一段", deferred: false, learning: "完成一个真实场景解释", resetDeferrals: true },
  { date: "2026-09-12", minutes: 15, mood: "低落", arrangement: "临时有事要去医院", interest: "对数据可视化产生兴趣", unfinished: "产品发布页还没写", deferred: false, learning: "完成一轮技能高考高频题并记录错因" },
  { date: "2026-09-13", minutes: 10, mood: "疲惫", arrangement: "今天很累，晚上只想休息", interest: "想做一个新的陪人学习项目", unfinished: "技能题第二轮没有完成", deferred: false, learning: "完成新场景 AI 应用并解释" },
  { date: "2026-09-14", minutes: 30, mood: "有信心", arrangement: "技能高考已经考完，周末有完整的一小段时间", interest: "继续做 AI 产品并补网络基础", unfinished: "产品发布页只剩校对", deferred: false, learning: "完成考试模拟并能解释错因" },
];

function applyDay(previous, day) {
  const text = `学习结果：${day.learning}；临时安排：${day.arrangement}；情绪：${day.mood}；新兴趣：${day.interest}；未完成任务：${day.unfinished}`;
  const now = new Date(`${day.date}T10:00:00Z`);
  const observation = observe(text, now);
  let state = updateUserModel(rememberObservation(previous, observation), observation);
  state.today_context = { available_minutes: day.minutes, source: "七天纵向仿真" };
  if (day.deferred) state.action_history.push({ action_id: `sim-${day.date}`, outcome: "deferred", reason: `建议未完成：${day.unfinished}`, at: observation.at });
  if (day.resetDeferrals) state.action_history.push({ action_id: `sim-verified-${day.date}`, outcome: "verified", evidence: day.learning, at: observation.at });
  state.recent_learning.push({ action_id: `learning-${day.date}`, title: day.learning, evidence: day.learning, at: observation.at, verification: "seven_day_simulation" });
  state.recent_learning = state.recent_learning.slice(-30);
  state = addSkillEvidence(state, "ai_application", day.learning, "verified");
  state.next_recommended_action = null;
  const diagnosis = diagnose(state);
  const action = diagnosis.confidence >= 0.74 ? decideNextAction(state, diagnosis) : null;
  return { state, day, observation, diagnosis, action, explanation: action ? formatProposal(action, diagnosis.confidence) : diagnosis.question };
}

function maxConsecutive(values) {
  let max = 0;
  let current = 0;
  let previous = null;
  for (const value of values) {
    if (value && value === previous) current += 1;
    else current = value ? 1 : 0;
    max = Math.max(max, current);
    previous = value;
  }
  return max;
}

test("seven-day longitudinal simulation records all five daily signals", t => {
  let state = createKnownAgentState();
  const initialGoals = state.long_term_goals.map(goal => goal.id);
  const outputs = [];
  for (const day of DAYS) {
    const result = applyDay(state, day);
    state = result.state;
    outputs.push(result);
    assert.equal(result.state.current_state.mood, day.mood, `${day.date} mood was not retained as current state`);
    assert.match(result.state.recent_events.at(-1).text, new RegExp(`学习结果：${day.learning}`));
    assert.match(result.state.recent_events.at(-1).text, new RegExp(`临时安排：${day.arrangement}`));
    assert.match(result.state.recent_events.at(-1).text, new RegExp(`新兴趣：${day.interest}`));
    assert.match(result.state.recent_events.at(-1).text, new RegExp(`未完成任务：${day.unfinished}`));
    if (day.deferred) assert.ok(result.state.action_history.some(item => item.reason?.includes(day.unfinished)), `${day.date} unfinished task was not recorded`);
  }
  assert.equal(outputs.length, 7);
  for (const result of outputs) {
    for (const field of ["learning", "arrangement", "mood", "interest", "unfinished"]) assert.ok(result.day[field], `${result.day.date} missing ${field}`);
  }
  assert.deepEqual(state.long_term_goals.map(goal => goal.id), initialGoals);
  const actions = outputs.map(result => result.action).filter(Boolean);
  assert.ok(actions.every(action => action.why_not_other_directions?.length), "every proposal should compare alternatives");
  assert.equal(outputs[0].state.direction_signals.ai_product.status, "first_signal");
  assert.equal(outputs[1].state.direction_signals.ai_product.status, "repeated_signal");
  assert.equal(outputs[3].state.direction_signals.ai_product.status, "path_candidate");
  const gapIds = outputs.map(result => result.action?.gap?.id || null);
  const titles = outputs.map(result => result.action?.title || null);
  const questionCount = outputs.filter(result => result.diagnosis.confidence < 0.74).length;
  t.diagnostic(JSON.stringify({
    metrics: {
      days: outputs.length,
      max_gap_streak: maxConsecutive(gapIds),
      max_exact_title_streak: maxConsecutive(titles),
      low_confidence_questions: questionCount,
      max_explanation_chars: Math.max(...outputs.map(result => result.explanation.length)),
      long_term_goals_unchanged: true,
      final_energy: state.current_state.energy,
      final_urgent_direction: state.current_state.urgent_direction,
    },
    daily: outputs.map(result => ({
      date: result.day.date,
      mood: result.state.current_state.mood,
      energy: result.state.current_state.energy,
      minutes: result.day.minutes,
      gap: result.diagnosis.gap?.id,
      related_direction: result.diagnosis.related_direction?.id,
      confidence: result.diagnosis.confidence,
      question: result.diagnosis.confidence < 0.74,
      title: result.action?.title || null,
      explanation_chars: result.explanation.length,
      direction_status: Object.fromEntries(Object.entries(result.state.direction_signals).map(([id, signal]) => [id, signal.status])),
    })),
  }, null, 2));
});

test("seven-day judgment should recover from friction, honor urgent exams, and raise difficulty", () => {
  let state = createKnownAgentState();
  const outputs = [];
  for (const day of DAYS) {
    const result = applyDay(state, day);
    state = result.state;
    outputs.push(result);
  }
  assert.ok(outputs.some(result => result.diagnosis.gap.id === "activation_friction"), "three missed days should be diagnosed as friction");
  assert.ok(outputs.some(result => result.diagnosis.gap.id === "exam_readiness"), "an imminent skills exam should outrank stale friction");
  assert.ok(outputs.some(result => result.diagnosis.gap.id === "apply_and_explain"), "verified progress should raise difficulty at least once");
  assert.equal(outputs.at(-1).state.current_state.urgent_direction, null, "resolved exam urgency should not persist forever");
  const repeatedTitles = outputs.map(result => result.action?.title).filter(Boolean);
  assert.ok(new Set(repeatedTitles).size >= 3, "planner should not emit one conservative action for the whole week");
  const gapIds = outputs.map(result => result.action?.gap?.id || null);
  assert.ok(maxConsecutive(gapIds) <= 3, "planner should not repeat one gap indefinitely");
  const titleStreak = maxConsecutive(outputs.map(result => result.action?.title || null));
  assert.ok(titleStreak <= 2, "the exact same recommendation should not become nagging");
  assert.equal(outputs.at(-1).diagnosis.gap.id, "apply_and_explain", "verified progress should end in a higher-value transfer step");
});

test("seven-day judgment should keep questions sparse and explanations usable", () => {
  let state = createKnownAgentState();
  const outputs = [];
  for (const day of DAYS) {
    const result = applyDay(state, day);
    state = result.state;
    outputs.push(result);
  }
  const questionCount = outputs.filter(result => result.diagnosis.confidence < 0.74).length;
  const maxExplanationChars = Math.max(...outputs.map(result => result.explanation.length));
  assert.ok(questionCount <= 2, `low confidence asked ${questionCount} times`);
  assert.ok(maxExplanationChars <= 900, `longest explanation was ${maxExplanationChars} characters`);
});
