export function updateUserModel(state, observation) {
  const next = structuredClone(state);
  if (observation.signals.tired) {
    next.current_constraints = [...new Set([...next.current_constraints, "当前精力较低（本次对话观察，待持续确认）"])];
  }
  if (observation.signals.busy) {
    next.current_constraints = [...new Set([...next.current_constraints, `新增现实安排：${observation.text}`])].slice(-12);
  }
  if (observation.signals.duration_minutes) {
    next.today_context = { ...(next.today_context || {}), available_minutes: observation.signals.duration_minutes, source: "用户本次对话" };
  }
  return next;
}

export function addSkillEvidence(state, skillId, evidence, assessment) {
  const next = structuredClone(state);
  const skill = next.skills[skillId] || { label: skillId, level: "unknown", confidence: 0.1, evidence: [] };
  skill.evidence = [...skill.evidence, evidence].slice(-8);
  skill.confidence = Math.min(0.95, skill.confidence + (assessment === "verified" ? 0.14 : 0.04));
  if (assessment === "verified") skill.level = skill.level === "unknown" ? "beginning" : "developing";
  next.skills[skillId] = skill;
  return next;
}
