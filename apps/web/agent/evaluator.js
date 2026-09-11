import { addSkillEvidence } from "./user-model.js";

export function evaluateCompletion(state, action, observation) {
  const text = observation.text;
  const evidenceHits = action.evidence_required.filter(term => text.includes(term));
  const hasConcreteLanguage = /我会|我能|先|今天|明天|在.+时|场景|变化|行动/.test(text);
  const enoughExplanation = text.length >= 28 && (evidenceHits.length >= 2 || hasConcreteLanguage);
  if (!enoughExplanation) {
    return {
      state,
      verified: false,
      reply: "我先不把它标记为完成。你已经说了结果，但我还缺少理解证据。请告诉我：它发生在什么具体场景、出现了什么可观察变化、下一次最小行动是什么？",
    };
  }
  let next = addSkillEvidence(state, action.skill_id, text, "verified");
  next.recent_learning.push({ action_id: action.id, title: action.title, at: observation.at, evidence: text, verification: "user_explanation", hints_used: next.tutor_session?.hints_used || 0 });
  next.recent_learning = next.recent_learning.slice(-30);
  next.action_history.push({ action_id: action.id, outcome: "verified", at: observation.at, evidence: text });
  next.next_recommended_action = null;
  next.tutor_session = null;
  next.phase = "learn";
  return { state: next, verified: true, reply: "这次可以记为有效进展，不是因为你点了完成，而是因为你给出了真实场景和下一步证据。我会用它重新判断后续方向，而不是重复发送同一任务。" };
}
