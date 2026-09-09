import { addSkillEvidence } from "./user-model.js";

export function evaluateCompletion(state, action, observation) {
  const text = observation.text;
  const evidenceHits = action.evidence_required.filter(term => text.includes(term));
  const enoughExplanation = text.length >= 28 && evidenceHits.length >= 2;
  if (!enoughExplanation) {
    return {
      state,
      verified: false,
      reply: "我先不把它标记为掌握。你已经说了做完，但我还缺少理解证据。请不用背定义，告诉我：你观察到的一个收益、一个代价，以及两者为什么会同时出现？",
    };
  }
  let next = addSkillEvidence(state, action.skill_id, text, "verified");
  next.recent_learning.push({ action_id: action.id, title: action.title, at: observation.at, evidence: text, verification: "user_explanation", hints_used: next.tutor_session?.hints_used || 0 });
  next.recent_learning = next.recent_learning.slice(-30);
  next.action_history.push({ action_id: action.id, outcome: "verified", at: observation.at, evidence: text });
  next.next_recommended_action = null;
  next.tutor_session = null;
  next.phase = "learn";
  return { state: next, verified: true, reply: "这次可以记为“已理解”，不是因为你点了完成，而是因为你给出了自己的因果解释。我已经把这条证据更新到你的通识能力模型里。下一步我会根据这个结果重新判断，而不是重复发同一任务。" };
}
