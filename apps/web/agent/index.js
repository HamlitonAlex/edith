import { observe } from "./observer.js";
import { rememberObservation, recordActionRevision } from "./memory.js";
import { updateUserModel } from "./user-model.js";
import { diagnose, decideNextAction, formatProposal } from "./planner.js";
import { beginTutor, tutorReply } from "./tutor.js";
import { evaluateCompletion } from "./evaluator.js";
export { createAgentState, hydrateAgentState } from "./state.js";
export { GENERAL_KNOWLEDGE_RESOURCES, findResourceCandidates, canRecommendResource } from "./resource-catalog.js";

const shorten = action => ({ ...action, duration_minutes: 10, status: "revised", instructions: `只完成最小版本：${action.instructions}` });

export function runAgentTurn(current, rawText, now = new Date()) {
  const observation = observe(rawText, now);
  let state = updateUserModel(rememberObservation(current, observation), observation);
  let action = state.next_recommended_action;

  if (action && observation.signals.asks_why) {
    state.phase = "negotiate";
    return { state, kind: "explanation", reply: action.why_now };
  }
  if (action && observation.signals.final_reject) {
    state.action_history.push({ action_id: action.id, outcome: "rejected", at: observation.at, reason: observation.text });
    state.next_recommended_action = null;
    state.tutor_session = null;
    state.phase = "learn";
    return { state, kind: "revision", reply: "好，我保留不同意见，但尊重你的最终决定。这项已经撤下，拒绝原因也会参与下一轮判断；我不会把它算作失败或意志力问题。" };
  }
  if (action && observation.signals.rejects) {
    state.phase = "negotiate";
    state.decision_log.push({ at: observation.at, action_id: action.id, decision: "challenge_rejection", reason: "拒绝原因尚不清楚，不能把一次反感误判成方向变化", confidence: 0.74 });
    return { state, kind: "challenge", reply: `我听到你不想做，但我暂时不同意直接取消。我的理由是：${action.why_now}\n\n不过我也可能判断错。你更接近哪一种：它和目标无关、今天状态不合适、还是这个具体材料不适合？知道原因后，我会坚持、换方法或撤回建议。最终决定仍然是你的。` };
  }
  if (action && (observation.signals.tired || observation.signals.busy)) {
    state.phase = "negotiate";
    return { state, kind: "negotiation", reply: `我不建议直接把它取消，也不会要求你机械坚持。\n\nA. 保留 ${action.duration_minutes} 分钟：方向连续，但今天的负担最大。\nB. 缩成 10 分钟：只完成最小观察，保住连续性。\nC. 推到明天：今天完全让路，但明天我会重新检查它是否仍是最重要的。\n\n结合你刚说的状态，我更倾向 B；最终由你选。` };
  }
  if (action && /缩|十分钟|10分钟/.test(observation.text)) {
    const revised = shorten(action);
    recordActionRevision(state, action, revised, "用户反馈精力或时间后协商缩短", observation.at);
    state.next_recommended_action = revised;
    state.phase = "propose";
    state.decision_log.push({ at: observation.at, action_id: revised.id, judgment: revised.judgment, decision: "shorten", reason: "用户反馈后仍保留方向连续性", confidence: 0.78 });
    return { state, kind: "proposal", reply: formatProposal(revised, 0.78) };
  }
  if (action && observation.signals.delays) {
    recordActionRevision(state, action, null, `用户选择推迟：${observation.text}`, observation.at);
    state.pending_items.push({ ...action, status: "deferred", revisit_at: "tomorrow" });
    state.next_recommended_action = null;
    state.phase = "learn";
    return { state, kind: "revision", reply: "已经推到明天。我保留了原计划、调整结果和原因；明天不会机械照搬，而会结合新的现实情况重新判断。" };
  }
  if (action && observation.signals.completed) {
    state.phase = "verify";
    return evaluateCompletion(state, action, observation);
  }
  if (action && state.tutor_session) {
    if (observation.signals.confused || observation.signals.wants_hint) {
      state.tutor_session = tutorReply(state.tutor_session, observation);
      return { state, kind: "tutor", reply: state.tutor_session.prompt };
    }
    state.phase = "verify";
    return evaluateCompletion(state, action, observation);
  }
  if (action && observation.signals.accepts) {
    state.phase = "execute";
    state.next_recommended_action = { ...action, status: "accepted" };
    state.tutor_session = beginTutor(action);
    return { state, kind: "tutor", reply: state.tutor_session.prompt };
  }
  const diagnosis = diagnose(state);
  state.last_diagnosis = diagnosis;
  if (!state.long_term_goals.length) {
    state.phase = "observe";
    return { state, kind: "question", reply: "我还不知道你希望长期变成怎样的人，所以现在不能负责任地替你决定下一步。先不用填问卷：最近哪件事最让你觉得“我不能再这样野蛮生长下去”？" };
  }
  action = decideNextAction(state, diagnosis);
  state.next_recommended_action = action;
  state.phase = "propose";
  state.decision_log.push({ at: observation.at, action_id: action.id, judgment: action.judgment, decision: "propose", reason: diagnosis.focus, evidence: diagnosis.evidence, confidence: diagnosis.confidence });
  state.decision_log = state.decision_log.slice(-30);
  const preface = diagnosis.missing.includes("今天可用时间") ? "我还不知道你今天准确有多少时间，所以先给一个可协商的小行动。\n\n" : "";
  return { state, kind: "proposal", reply: preface + formatProposal(action, diagnosis.confidence) };
}
