export function createAgentState(now = new Date()) {
  return {
    schema_version: 1,
    updated_at: now.toISOString(),
    phase: "decide",
    current_stage: "",
    long_term_goals: [],
    active_goals: [],
    interests: [],
    skills: {
      ai_application: { label: "AI 应用", level: "unknown", confidence: 0.2, evidence: [] },
      product: { label: "产品能力", level: "unknown", confidence: 0.2, evidence: [] },
      computer_basics: { label: "计算机基础", level: "unknown", confidence: 0.2, evidence: [] },
      english_expression: { label: "英语表达", level: "unknown", confidence: 0.2, evidence: [] },
      general_knowledge: { label: "通识结构", level: "unknown", confidence: 0.2, evidence: [] },
    },
    recent_learning: [],
    learning_results: [],
    tutor_metrics: {
      current: null,
      history: [],
      totals: {
        started: 0,
        completed: 0,
        interrupted: 0,
        verification_attempts: 0,
        total_turns: 0,
        total_hints: 0,
        total_adaptations: 0,
      },
    },
    recent_events: [],
    current_constraints: [],
    current_state: { energy: "unknown", urgent_direction: null, last_observed_at: null },
    direction_signals: {},
    pending_items: [],
    next_recommended_action: null,
    action_history: [],
    memory: [],
    tutor_session: null,
    last_diagnosis: null,
    decision_log: [],
    agency_policy: {
      may_disagree: true,
      must_show_reasoning_summary: true,
      must_name_uncertainty: true,
      user_has_final_authority: true,
    },
    principles: [
      "优先真实成长，不用完成数量制造进步感",
      "一次只推进最值得做的一件事",
      "没有理解证据就不声称掌握",
      "现实状态会改变方法，但不自动抹掉长期方向",
    ],
  };
}

export function hydrateAgentState(saved) {
  const base = createAgentState();
  if (!saved || saved.schema_version !== base.schema_version) return base;
  const asArray = value => Array.isArray(value) ? value : [];
  const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const objectArray = value => asArray(value).filter(item => item && typeof item === "object" && !Array.isArray(item));
  const stringArray = value => asArray(value).filter(item => typeof item === "string");
  const boundedRatio = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  };
  const normalizeSkill = (fallback, candidate) => {
    const source = asObject(candidate);
    return {
      ...fallback,
      ...source,
      label: typeof source.label === "string" && source.label.trim() ? source.label.trim().slice(0, 80) : fallback.label,
      level: typeof source.level === "string" ? source.level : fallback.level,
      confidence: boundedRatio(source.confidence, fallback.confidence),
      evidence: stringArray(source.evidence).slice(-8),
    };
  };
  const isLegacyTransientGoal = item => /(?:今天|现在).{0,12}(?:累|困|躺着|不想动)/.test(String(item?.text || ""));
  const savedSkills = asObject(saved.skills);
  const skillIds = [...new Set([...Object.keys(base.skills), ...Object.keys(savedSkills)])];
  const skills = Object.fromEntries(skillIds.map(id => [
    id,
    normalizeSkill(base.skills[id] || { label: id, level: "unknown", confidence: 0.1, evidence: [] }, savedSkills[id]),
  ]));
  const tutorMetrics = asObject(saved.tutor_metrics);
  const savedTotals = asObject(tutorMetrics.totals);
  const totals = Object.fromEntries(Object.keys(base.tutor_metrics.totals).map(key => {
    const number = Number(savedTotals[key]);
    return [key, Number.isFinite(number) && number >= 0 ? number : base.tutor_metrics.totals[key]];
  }));
  return {
    ...base,
    ...saved,
    long_term_goals: objectArray(saved.long_term_goals).filter(item => !isLegacyTransientGoal(item)),
    active_goals: asArray(saved.active_goals).filter(item => typeof item === "string" || (item && typeof item === "object" && !Array.isArray(item))),
    interests: asArray(saved.interests).filter(item => typeof item === "string" || (item && typeof item === "object" && !Array.isArray(item))),
    recent_learning: objectArray(saved.recent_learning),
    learning_results: objectArray(saved.learning_results),
    recent_events: objectArray(saved.recent_events),
    current_constraints: stringArray(saved.current_constraints),
    pending_items: objectArray(saved.pending_items).filter(item => !(item?.kind === "long_term_goal_inference" && isLegacyTransientGoal(item))),
    action_history: objectArray(saved.action_history),
    memory: objectArray(saved.memory),
    decision_log: objectArray(saved.decision_log),
    next_recommended_action: saved.next_recommended_action && typeof saved.next_recommended_action === "object" && !Array.isArray(saved.next_recommended_action) && !isLegacyTransientGoal({ text: saved.next_recommended_action.title })
      ? saved.next_recommended_action
      : null,
    skills,
    tutor_metrics: {
      ...base.tutor_metrics,
      ...tutorMetrics,
      current: tutorMetrics.current && typeof tutorMetrics.current === "object" && !Array.isArray(tutorMetrics.current) ? tutorMetrics.current : null,
      history: objectArray(tutorMetrics.history).slice(-30),
      totals: {
        ...totals,
      },
    },
    current_state: { ...base.current_state, ...asObject(saved.current_state) },
    direction_signals: { ...asObject(saved.direction_signals) },
    tutor_session: saved.tutor_session && typeof saved.tutor_session === "object" && !Array.isArray(saved.tutor_session) ? saved.tutor_session : null,
  };
}
