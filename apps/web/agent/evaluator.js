import { recordLearningResult } from "./memory.js";
import { addSkillEvidence } from "./user-model.js";
import { isTutorCompletionEvidence } from "./tutor.js";

function partialTopic(text, topic) {
  const match = text.match(/(?:还要巩固|部分掌握|还不会|仍然不确定|需要再练)([^。；;]+)/);
  return match?.[1]?.trim() || (/(?:还要巩固|部分掌握|还不会|仍然不确定|需要再练)/.test(text) ? `${topic} 的迁移` : null);
}

function buildLearningResult(action, session, observation, text) {
  const topic = session?.topic || action.title;
  const partial = partialTopic(text, topic);
  const errors = [...new Set(session?.error_causes || [])];
  const independent = /(?:独立|自己完成|新场景|迁移|会写出|能解释清楚)/.test(text);
  const mastered = independent || /(?:掌握了|理解了|能解释|会写)/.test(text) ? [topic] : [];
  const unmastered = errors.length && !mastered.length ? [topic] : [];
  const verification = independent ? "independent_transfer" : "user_explanation";
  const nextSuggestion = partial
    ? `下一次先用一个新例子巩固“${partial}”，再决定是否提高难度。`
    : `下一次把“${topic}”换到一个新场景，确认理解能迁移。`;
  return {
    id: `learning-${action.id}-${observation.at.replace(/\D/g, "").slice(-14)}`,
    action_id: action.id,
    at: observation.at,
    domain: session?.domain || "general_knowledge",
    topic,
    learned: `今天学了“${topic}”以及它在实际问题中的用法。`,
    mastered,
    partial: partial ? [partial] : [],
    unmastered,
    common_errors: errors,
    next_suggestion: nextSuggestion,
    verification,
    evidence: text,
    confidence: independent ? 0.92 : 0.84,
  };
}

function learningReply(result) {
  const mastered = result.mastered.length ? result.mastered.join("、") : "还没有足够的掌握证据";
  const partial = result.partial.length ? result.partial.join("、") : "暂无明确的部分掌握项";
  return `今天学了：${result.learned}\n\n已经掌握：${mastered}\n部分掌握：${partial}\n\n下一次：${result.next_suggestion}`;
}

export function evaluateCompletion(state, action, observation) {
  const text = observation.text;
  const session = state.tutor_session;
  const evidenceRequired = action.evidence_required || [];
  const evidenceHits = evidenceRequired.filter(term => text.includes(term));
  const hasConcreteLanguage = /我会|我能|先|今天|明天|在.+时|场景|变化|行动|解释|输出|步骤/.test(text);
  const tutorEvidence = session && isTutorCompletionEvidence(text, session);
  const enoughExplanation = (text.length >= 28 && (evidenceHits.length >= 2 || hasConcreteLanguage)) || Boolean(tutorEvidence);
  if (!enoughExplanation) {
    return {
      state: { ...state, phase: "verify" },
      verified: false,
      reply: "我先不把它标记为完成。你已经说了结果，但我还缺少理解证据。请告诉我：它发生在什么具体场景、出现了什么可观察变化、下一次最小行动是什么？",
    };
  }

  const result = buildLearningResult(action, session, observation, text);
  let next = addSkillEvidence(state, session?.skill_id || action.skill_id, text, "verified");
  next = recordLearningResult(next, result);
  next.recent_learning.push({
    result_id: result.id,
    action_id: action.id,
    title: action.title,
    topic: result.topic,
    domain: result.domain,
    at: observation.at,
    evidence: text,
    verification: result.verification,
    mastered: result.mastered,
    partial: result.partial,
    unmastered: result.unmastered,
    common_errors: result.common_errors,
    next_suggestion: result.next_suggestion,
    hints_used: session?.hints_used || 0,
  });
  next.recent_learning = next.recent_learning.slice(-30);
  next.action_history.push({ action_id: action.id, outcome: "verified", at: observation.at, evidence: text, result_id: result.id });
  next.action_history = next.action_history.slice(-30);
  next.next_recommended_action = null;
  next.tutor_session = null;
  next.phase = "learn";
  return { state: next, verified: true, learning_result: result, reply: learningReply(result) };
}
