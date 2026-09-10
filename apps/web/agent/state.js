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

export function createKnownAgentState(now = new Date()) {
  const state = createAgentState(now);
  state.current_stage = "把想法变成可验证的个人产品";
  state.long_term_goals = [{ id: "build-xuecheng", text: "完成并公开发布一个真正可安装的私人教育伙伴", confidence: 0.96, source: "连续对话" }];
  state.active_goals = ["用学程项目训练 AI 协作、产品判断与持续执行"];
  state.interests = ["AI 应用", "产品设计", "真实项目", "通识"];
  state.skills.ai_application = { label: "AI 应用", level: "developing", confidence: 0.62, evidence: ["持续推进学程项目"] };
  state.skills.product = { label: "产品能力", level: "developing", confidence: 0.58, evidence: ["能持续指出产品与现实生活的距离"] };
  state.current_constraints = ["不希望依赖每日手工记录", "主要使用 iPhone 与 Windows"];
  return state;
}

export function hydrateAgentState(saved) {
  const base = createAgentState();
  if (!saved || saved.schema_version !== base.schema_version) return base;
  return { ...base, ...saved, skills: { ...base.skills, ...saved.skills } };
}
