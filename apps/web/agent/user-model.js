export function updateUserModel(state, observation) {
  const next = structuredClone(state);
  next.current_state = { ...(next.current_state || {}), last_observed_at: observation.at };
  const mood = observation.signals.mood;
  if (mood) {
    next.current_state.mood = mood;
    next.current_state.mood_at = observation.at;
    if (["疲惫", "低落"].includes(mood)) next.current_state.energy = "low";
    if (["专注", "稳定", "有信心"].includes(mood)) next.current_state.energy = "available";
  }
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
  if (observation.signals.skills_exam_resolved) {
    next.current_state.urgent_direction = null;
    next.current_state.urgent_reason = null;
    next.current_state.urgent_resolved_at = observation.at;
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

const emptyTutorFeedback = () => ({
  repeated_prompting: null,
  rapid_mastery: null,
  recurring_english_error: null,
  interrupted_task: null,
  lowered_failure: null,
  domain_shift: null,
  preferred_teaching_style: null,
});

function tutorSessions(state) {
  return (state?.tutor_metrics?.history || [])
    .filter(session => session && session.id)
    .map((session, index) => ({ ...session, _index: index }))
    .sort((a, b) => {
      const aAt = Date.parse(a.ended_at || a.started_at || "") || a._index;
      const bAt = Date.parse(b.ended_at || b.started_at || "") || b._index;
      return aAt - bAt || a._index - b._index;
    });
}

function sessionKey(session) {
  return `${session.domain || "unknown"}::${session.topic || "unknown"}`;
}

function groupedSessions(sessions, predicate = () => true) {
  const groups = new Map();
  for (const session of sessions.filter(predicate)) {
    const key = sessionKey(session);
    const group = groups.get(key) || [];
    if (!group.some(item => item.id === session.id)) group.push(session);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length >= 2).sort((a, b) => {
    const aAt = Date.parse(a.at(-1)?.ended_at || "") || a.at(-1)?._index || 0;
    const bAt = Date.parse(b.at(-1)?.ended_at || "") || b.at(-1)?._index || 0;
    return bAt - aAt;
  });
}

function latestGroup(groups) {
  return groups[0] || null;
}

function feedbackBasis(group) {
  return {
    count: group.length,
    domain: group[0]?.domain || "general_knowledge",
    topic: group[0]?.topic || "这个知识点",
    session_ids: group.map(session => session.id),
  };
}

function resultById(state) {
  return new Map((state?.learning_results || []).map(result => [result.id, result]));
}

/**
 * Derive a small, deterministic set of longitudinal signals from the existing
 * Tutor summaries and learning results. Nothing is persisted here: the same
 * user model remains the source of truth, and every signal needs two distinct
 * sessions before it can affect a future decision.
 */
export function deriveTutorFeedback(state = {}) {
  const feedback = emptyTutorFeedback();
  const sessions = tutorSessions(state);
  const results = resultById(state);

  const promptGroup = latestGroup(groupedSessions(sessions, session =>
    (session.hints_used || 0) >= 2,
  ));
  if (promptGroup) {
    feedback.repeated_prompting = {
      ...feedbackBasis(promptGroup),
      confidence: 0.84,
      rule: "two_independent_prompt_heavy_sessions",
    };
  }

  const masteryGroup = latestGroup(groupedSessions(sessions, session =>
    session.status === "mastered" &&
    (session.hints_used || 0) === 0 &&
    (session.adaptations || 0) === 0 &&
    ["baseline", "transfer"].includes(session.last_stage || "baseline") &&
    (session.turn_count || 0) <= 2,
  ));
  if (masteryGroup) {
    feedback.rapid_mastery = {
      ...feedbackBasis(masteryGroup),
      confidence: 0.88,
      rule: "two_independent_fast_verified_sessions",
    };
  }

  const englishErrors = new Map();
  for (const session of sessions.filter(item => item.domain === "english" && item.result_id)) {
    const result = results.get(session.result_id);
    for (const error of new Set(result?.common_errors || [])) {
      const key = `${session.topic || "英语表达"}::${error}`;
      const group = englishErrors.get(key) || [];
      if (!group.some(item => item.session.id === session.id)) group.push({ session, result });
      englishErrors.set(key, group);
    }
  }
  const recurringEnglish = [...englishErrors.values()]
    .filter(group => group.length >= 2)
    .sort((a, b) => (b.at(-1).session._index || 0) - (a.at(-1).session._index || 0))[0];
  if (recurringEnglish) {
    const basis = recurringEnglish.map(item => item.session);
    feedback.recurring_english_error = {
      ...feedbackBasis(basis),
      error: recurringEnglish[0].result?.common_errors?.[0] || "expression",
      confidence: 0.86,
      rule: "same_english_error_in_two_verified_results",
    };
  }

  const interruptedGroup = latestGroup(groupedSessions(sessions, session => session.status === "interrupted"));
  if (interruptedGroup) {
    feedback.interrupted_task = {
      ...feedbackBasis(interruptedGroup),
      confidence: 0.82,
      rule: "two_independent_interrupted_sessions",
    };
  }

  const loweredFailureGroup = latestGroup(groupedSessions(sessions, session =>
    ["weak", "partial"].includes(session.status) &&
    ((session.last_difficulty || "") === "lower" || (session.adaptations || 0) >= 2),
  ));
  if (loweredFailureGroup) {
    feedback.lowered_failure = {
      ...feedbackBasis(loweredFailureGroup),
      confidence: 0.9,
      rule: "two_failures_after_lowering",
    };
  }

  const domains = [...new Set(sessions.map(session => session.domain).filter(Boolean))];
  const latestDomain = sessions.at(-1)?.domain;
  const previousDomain = [...sessions].reverse().find(session => session.domain && session.domain !== latestDomain)?.domain;
  const latestDomainSessions = sessions.filter(session => session.domain === latestDomain);
  const previousDomainSessions = sessions.filter(session => session.domain === previousDomain);
  if (
    latestDomain &&
    previousDomain &&
    latestDomain !== previousDomain &&
    latestDomainSessions.length >= 2 &&
    previousDomainSessions.length >= 2 &&
    domains.length >= 2
  ) {
    feedback.domain_shift = {
      from: previousDomain,
      to: latestDomain,
      count: latestDomainSessions.length,
      confidence: 0.8,
      rule: "two_sessions_in_new_domain_after_prior_domain",
    };
  }

  const styleGroups = new Map();
  for (const session of sessions.filter(item => item.status === "mastered" && item.last_stage)) {
    const group = styleGroups.get(session.last_stage) || [];
    if (!group.some(item => item.id === session.id)) group.push(session);
    styleGroups.set(session.last_stage, group);
  }
  const preferredStyle = [...styleGroups.values()]
    .filter(group => group.length >= 2)
    .sort((a, b) => (b.at(-1)._index || 0) - (a.at(-1)._index || 0))[0];
  if (preferredStyle) {
    feedback.preferred_teaching_style = {
      stage: preferredStyle[0].last_stage,
      count: preferredStyle.length,
      domain: preferredStyle[0].domain,
      topic: preferredStyle[0].topic,
      confidence: 0.78,
      rule: "same_successful_tutor_stage_twice",
    };
  }

  return feedback;
}
