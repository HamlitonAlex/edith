import { observe } from "./observer.js";
import {
  finishTutorMetrics,
  recordActionRevision,
  recordTutorTurn,
  rememberObservation,
  startTutorMetrics,
} from "./memory.js";
import { updateUserModel } from "./user-model.js";
import { diagnose, decideNextAction, formatProposal, formatProposalSummary } from "./planner.js";
import { beginTutor, isTutorCompletionEvidence, tutorReply } from "./tutor.js";
import { evaluateCompletion } from "./evaluator.js";
export { createAgentState, hydrateAgentState } from "./state.js";
export { GENERAL_KNOWLEDGE_RESOURCES, findResourceCandidates, canRecommendResource } from "./resource-catalog.js";

const shorten = action => {
  const instructions = `只完成最小版本：${action.instructions}`;
  return { ...action, duration_minutes: 10, estimated_time: 10, status: "revised", instructions, suggested_method: instructions };
};

const decisionSignals = [
  "accepts", "rejects", "final_reject", "delays", "tired", "busy", "new_idea",
  "wants_new_direction", "wants_other", "asks_why", "completed", "confused", "wants_hint",
  "uncertain", "wants_answer", "tutor_question", "can_read_cannot_write", "weak_baseline", "fast_understanding",
];

const hasDecisionSignal = signals => decisionSignals.some(key => Boolean(signals[key]))
  || signals.duration_minutes != null
  || Boolean(signals.skills_exam_urgent || signals.skills_exam_resolved);

export function runAgentTurn(current, rawText, now = new Date()) {
  const observation = observe(rawText, now);
  let state = updateUserModel(rememberObservation(current, observation), observation);
  let action = state.next_recommended_action;

  if (!action && (observation.signals.tired || observation.signals.busy)) {
    state.phase = "observe";
    return {
      state,
      kind: "reflection",
      reply: observation.signals.tired
        ? "听起来你现在是真的累了。我先不急着把它变成任务，也不替你安排补偿。你想让我先陪你把这份累说清楚，还是安静地把今天先放下？"
        : "我先看见你眼前的现实安排，不急着把它塞进学习计划。等你有空再说一句现在最需要我帮你看清什么，我们再判断下一步。",
    };
  }

  const pendingGoal = state.pending_items.find(item => item.kind === "long_term_goal_inference" && item.status === "awaiting_confirmation");
  if (pendingGoal && observation.signals.accepts) {
    state.long_term_goals.push({ id: `goal-${now.getTime()}`, text: pendingGoal.text, confidence: 0.9, source: "用户确认" });
    state.pending_items = state.pending_items.filter(item => item !== pendingGoal);
    state.phase = "observe";
    return { state, kind: "confirmation", reply: "好，我把它作为目前的长期方向记下了，但不会把它当成永远不能改变的标签。接下来我还需要慢慢了解：你现在离它最近的能力是什么，最容易卡住的又是什么？" };
  }
  if (!state.long_term_goals.length && /想|希望|目标|成为|以后|未来/.test(observation.text) && observation.text.length >= 8) {
    state.pending_items.push({ kind: "long_term_goal_inference", text: observation.text, source: "conversation", confidence: 0.64, status: "awaiting_confirmation", created_at: observation.at });
    state.phase = "observe";
    return { state, kind: "confirmation", reply: `我先不擅自把它写成你的人生目标。我的理解是：“${observation.text}”是你现阶段想走的长期方向。这个理解准确吗？` };
  }

  if (!state.tutor_session && !hasDecisionSignal(observation.signals) && observation.signals.intent === "discussion") {
    state.phase = "observe";
    return {
      state,
      kind: "discussion",
      reply: "可以，先聊这件事。你想从发生了什么、哪里卡住，还是你希望它变成什么开始？",
    };
  }
  if (!state.tutor_session && !hasDecisionSignal(observation.signals) && observation.signals.intent === "listening") {
    state.phase = "observe";
    return {
      state,
      kind: "listening",
      reply: "我听到了。今天先不把这句话变成任务；如果你愿意，继续说。",
    };
  }

  if (action && observation.signals.new_idea) {
    const alreadySaved = state.pending_items.some(item => item.kind === "idea_to_revisit" && item.text === observation.text);
    if (!alreadySaved) {
      state.pending_items.push({
        kind: "idea_to_revisit",
        text: observation.text,
        source: "conversation",
        confidence: 0.52,
        status: "open_for_discussion",
        created_at: observation.at,
      });
    }
    state.phase = "observe";
    return {
      state,
      kind: "idea",
      reply: "我先把这个想法放在这里，不急着打乱你正在推进的方向。它可能值得长成一条新的线，但先不让它替你抢走现在最重要的事。你想现在聊聊它，还是等这一小步走完再回来？",
    };
  }

  if (action && (observation.signals.wants_new_direction || observation.signals.wants_other)) {
    if (state.tutor_session) {
      state = finishTutorMetrics(state, {
        observation,
        status: "interrupted",
        reason: observation.text,
      });
      state.tutor_session = null;
    }
    state.phase = "negotiate";
    state.decision_log.push({
      at: observation.at,
      action_id: action.id,
      decision: "negotiate_direction",
      reason: "用户希望改变方向，先理解变化而不是立刻替换行动",
      confidence: 0.7,
    });
    return {
      state,
      kind: "negotiate_direction",
      reply: "可以换，但我先不急着换成另一个任务：你想换的是今天这件事、今天的节奏，还是更长期的方向？如果只是今天，我可以把原步骤缩短或暂停；如果是方向，我们一起比较后再换。你可以坚持自己的选择，最终决定仍然是你的。",
    };
  }

  if (action && observation.signals.final_reject) {
    if (state.tutor_session) {
      state = finishTutorMetrics(state, {
        observation,
        status: "interrupted",
        reason: observation.text,
      });
    }
    state.action_history.push({ action_id: action.id, outcome: "rejected", at: observation.at, reason: observation.text });
    state.next_recommended_action = null;
    state.tutor_session = null;
    state.phase = "learn";
    return { state, kind: "revision", reply: "好，我保留不同意见，但尊重你的最终决定。这项已经撤下，拒绝原因也会参与下一轮判断；我不会把它算作失败或意志力问题。" };
  }
  if (action && observation.signals.rejects) {
    state.phase = "negotiate";
    state.decision_log.push({ at: observation.at, action_id: action.id, decision: "challenge_rejection", reason: "拒绝原因尚不清楚，不能把一次反感误判成方向变化", confidence: 0.74 });
    return { state, kind: "challenge", reply: "我听到你不想做。先不把它算成失败：更像是哪一种——任务太大、时间不合适、今天状态不好、你不认可这个方向，还是我也可能判断错？你可以缩短、换方式、推迟，或坚持做你想做的事；最终决定仍然是你的。" };
  }
  if (action && (observation.signals.tired || observation.signals.busy)) {
    state.phase = "negotiate";
    return { state, kind: "negotiation", reply: `我不建议直接把它取消，也不会要求你机械坚持。\n\nA. 保留 ${action.duration_minutes} 分钟：方向连续，但今天的负担最大。\nB. 缩成 10 分钟：只完成最小观察，保住连续性。\nC. 推到明天：今天完全让路，但明天我会重新检查它是否仍是最重要的。\n\n结合你刚说的状态，我更倾向 B；最终由你选。` };
  }
  if (action && /缩成|缩短|改成\s*(?:10|十)\s*分钟|只做\s*(?:10|十)\s*分钟|选\s*B/i.test(observation.text)) {
    const revised = shorten(action);
    recordActionRevision(state, action, revised, "用户反馈精力或时间后协商缩短", observation.at);
    state.next_recommended_action = revised;
    state.phase = "propose";
    state.decision_log.push({ at: observation.at, action_id: revised.id, judgment: revised.judgment, decision: "shorten", reason: "用户反馈后仍保留方向连续性", confidence: 0.78 });
    return { state, kind: "proposal", reply: formatProposal(revised, 0.78), summary_reply: formatProposalSummary(revised) };
  }
  const suppliedEvidence = action?.evidence_required
    ?.filter(term => observation.text.includes(term)).length >= 2;
  if (action && state.tutor_session && (observation.signals.completed || isTutorCompletionEvidence(observation.text, state.tutor_session))) {
    state.phase = "verify";
    return evaluateCompletion(state, action, observation);
  }
  if (action && state.tutor_session) {
    state.tutor_session = tutorReply(state.tutor_session, observation);
    state = recordTutorTurn(state, state.tutor_session, observation);
    state.phase = "execute";
    return { state, kind: "tutor", reply: state.tutor_session.prompt };
  }
  if (action && observation.signals.asks_why) {
    state.phase = "negotiate";
    return { state, kind: "explanation", reply: action.why_now };
  }
  if (action && (observation.signals.completed || suppliedEvidence)) {
    state.phase = "verify";
    return evaluateCompletion(state, action, observation);
  }
  if (action && observation.signals.delays) {
    if (state.tutor_session) {
      state = finishTutorMetrics(state, {
        observation,
        status: "interrupted",
        reason: observation.text,
      });
      state.tutor_session = null;
    }
    recordActionRevision(state, action, null, `用户选择推迟：${observation.text}`, observation.at);
    state.pending_items.push({ ...action, status: "deferred", revisit_at: "tomorrow" });
    state.next_recommended_action = null;
    state.phase = "learn";
    return { state, kind: "revision", reply: "已经推到明天。我保留了原计划、调整结果和原因；明天不会机械照搬，而会结合新的现实情况重新判断。" };
  }
  if (action && observation.signals.accepts) {
    state.phase = "execute";
    state.next_recommended_action = { ...action, status: "accepted" };
    state.tutor_session = beginTutor(action, observation);
    state = startTutorMetrics(state, state.tutor_session, observation);
    return { state, kind: "tutor", reply: state.tutor_session.prompt };
  }
  const diagnosis = diagnose(state);
  state.last_diagnosis = diagnosis;
  if (!state.long_term_goals.length) {
    state.phase = "observe";
    return { state, kind: "question", reply: "我还不知道你希望长期变成怎样的人，所以现在不能负责任地替你决定下一步。先不用填问卷：最近哪件事最让你觉得“我不能再这样野蛮生长下去”？" };
  }
  if (diagnosis.confidence < 0.74) {
    state.phase = "observe";
    return { state, kind: "question", reply: diagnosis.question };
  }
  action = decideNextAction(state, diagnosis);
  state.next_recommended_action = action;
  state.phase = "propose";
  state.decision_log.push({ at: observation.at, action_id: action.id, title: action.title, gap_id: action.gap?.id, judgment: action.judgment, decision: "propose", reason: diagnosis.focus, evidence: diagnosis.evidence, confidence: diagnosis.confidence });
  state.decision_log = state.decision_log.slice(-30);
  const preface = diagnosis.missing.includes("今天可用时间") ? "我还不知道你今天准确有多少时间，所以先给一个可协商的小行动。\n\n" : "";
  return { state, kind: "proposal", reply: preface + formatProposal(action, diagnosis.confidence), summary_reply: formatProposalSummary(action) };
}
