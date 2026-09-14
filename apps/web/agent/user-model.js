export function updateUserModel(state, observation) {
  const next = structuredClone(state);
  next.current_state = { ...(next.current_state || {}), last_observed_at: observation.at };
  if (observation.signals.tired) {
    next.current_state.energy = "low";
    next.current_state.energy_source = "本次对话观察，待持续确认";
    next.current_state.transient_note = observation.text;
  }
  if (observation.signals.busy) {
    next.current_state.energy = next.current_state.energy === "low" ? "low" : "constrained";
    next.current_constraints = [...new Set([...next.current_constraints, `新增现实安排：${observation.text}`])].slice(-12);
  }
  if (observation.signals.skills_exam_urgent) {
    next.current_state.urgent_direction = "skills_exam";
    next.current_state.urgent_reason = observation.text;
  }
  if (observation.signals.duration_minutes) {
    next.today_context = { ...(next.today_context || {}), available_minutes: observation.signals.duration_minutes, source: "用户本次对话" };
  }
  const directionLabels = {
    ai_product: "AI 产品能力",
    skills_exam: "技能高考",
    network_foundations: "计算机网络基础",
  };
  for (const id of observation.signals.direction_mentions || []) {
    const previous = next.direction_signals[id] || { id, label: directionLabels[id] || id, occurrences: 0, unique_days: [], evidence: [] };
    const day = observation.at.slice(0, 10);
    const uniqueDays = [...new Set([...(previous.unique_days || []), day])].slice(-30);
    const occurrences = previous.occurrences + 1;
    next.direction_signals[id] = {
      ...previous,
      occurrences,
      unique_days: uniqueDays,
      first_seen: previous.first_seen || observation.at,
      last_seen: observation.at,
      strength: Math.min(1, 0.18 * occurrences + 0.12 * uniqueDays.length),
      status: occurrences >= 3 && uniqueDays.length >= 3 ? "path_candidate" : occurrences >= 2 ? "repeated_signal" : "first_signal",
      evidence: [...(previous.evidence || []), observation.text].slice(-6),
    };
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
