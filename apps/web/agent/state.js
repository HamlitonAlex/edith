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
      general_knowledge: { label: "通识结构", level: "unknown", confidence: 0.2, evidence: [] },
    },
    recent_learning: [],
    recent_events: [],
    current_constraints: [],
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
  return { ...base, ...saved, skills: { ...base.skills, ...saved.skills } };
}
