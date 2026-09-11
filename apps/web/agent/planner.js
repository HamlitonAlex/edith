export function diagnose(state) {
  const missing = [];
  if (!state.long_term_goals.length) missing.push("长期目标");
  if (!state.today_context?.available_minutes) missing.push("今天可用时间");
  const repeatedDelay = state.action_history.filter(item => item.reason?.includes("推迟")).length >= 2;
  return {
    focus: repeatedDelay ? "降低行动阻力，同时保持方向连续" : "把长期方向落到一个现实中可观察的变化",
    evidence: [state.current_stage, ...state.current_constraints.slice(-2)].filter(Boolean),
    missing,
    confidence: missing.length ? 0.68 : 0.82,
  };
}

function chooseLearningArea(state) {
  return Object.entries(state.skills)
    .sort(([, a], [, b]) => (a.confidence ?? 0) - (b.confidence ?? 0))[0]?.[0] || "self_direction";
}

export function decideNextAction(state, diagnosis) {
  if (!state.long_term_goals.length) return null;
  const primaryGoal = state.long_term_goals[0];
  const available = state.today_context?.available_minutes;
  const duration = available ? Math.min(15, Math.max(8, available)) : 12;
  const skillId = chooseLearningArea(state);
  const constraint = state.current_constraints.at(-1);
  return {
    id: `clarify-goal-${Date.now()}`,
    goal_id: primaryGoal.id,
    skill_id: skillId,
    title: `把“${primaryGoal.text}”推进到一个现实场景`,
    duration_minutes: duration,
    platform: "学程 · 对话",
    resource: null,
    instructions: "我会一次问一个问题。先说：如果这个方向今天真的前进了一小步，你的现实生活里会出现什么看得见的变化？",
    completion_criteria: "能说出一个具体场景、一项可观察变化，以及你愿意尝试的最小行动。",
    why_now: `你已经确认“${primaryGoal.text}”是当前方向，但我掌握的证据还不足以替你选择外部课程。先把目标落到真实场景，后续推荐才会属于你，而不是套用一份固定清单。${constraint ? `我也会把“${constraint}”作为现实限制。` : ""}`,
    judgment: "目前最重要的不是立刻塞入一门课程，而是先确认目标在现实生活中具体长什么样。",
    counterpoint: "如果你今天已经有明确而紧迫的现实任务，我会优先帮助你处理它，再判断学习方向。",
    reconsider_if: "你补充了更紧迫的安排、已有能力证据或明确想用的材料",
    evidence_required: ["具体场景", "可观察变化", "最小行动"],
    proposed_at: new Date().toISOString(),
    status: "proposed",
    diagnosis: diagnosis.focus,
  };
}

export function formatProposal(action, confidence = 0.7) {
  return `我的判断：\n${action.judgment}\n\n下一件事：\n${action.title}\n\n时间：\n${action.duration_minutes} 分钟\n\n为什么现在值得做：\n${action.why_now}\n\n怎么做：\n${action.instructions}\n\n完成标准：\n${action.completion_criteria}\n\n我的保留意见：\n${action.counterpoint}\n\n把握：${Math.round(confidence * 100)}%。如果“${action.reconsider_if}”，我会改变判断。\n\n你可以接受、缩短、推迟、反对，或者继续追问。最终由你决定。`;
}
