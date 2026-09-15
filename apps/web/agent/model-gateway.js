const cleanText = value => String(value || "").trim();

function tutorMetricsContext(state) {
  const metrics = state.tutor_metrics || {};
  const compactSession = session => {
    const item = session || {};
    return {
      id: item.id,
      action_id: item.action_id,
      domain: item.domain,
      topic: item.topic,
      started_at: item.started_at,
      ended_at: item.ended_at,
      duration_minutes: item.duration_minutes,
      status: item.status,
      turn_count: item.turn_count,
      hints_used: item.hints_used,
      adaptations: item.adaptations,
      verification_attempts: item.verification_attempts,
      last_stage: item.last_stage,
      last_difficulty: item.last_difficulty,
      result_id: item.result_id,
      confidence: item.confidence,
    };
  };
  const current = metrics.current;
  return {
    current: current ? compactSession(current) : null,
    recent_sessions: (metrics.history || []).slice(-5).map(compactSession),
    totals: metrics.totals || {},
  };
}

export function createModelContext(state, latestMessage) {
  return {
    current_stage: state.current_stage,
    long_term_goals: state.long_term_goals.map(goal => ({ text: goal.text, confidence: goal.confidence, source: goal.source })),
    active_goals: state.active_goals,
    skills: Object.fromEntries(Object.entries(state.skills).map(([id, skill]) => [id, { label: skill.label, level: skill.level, confidence: skill.confidence, evidence: skill.evidence.slice(-3) }])),
    recent_learning: state.recent_learning.slice(-7),
    learning_results: (state.learning_results || []).slice(-5),
    tutor_metrics: tutorMetricsContext(state),
    current_constraints: state.current_constraints.slice(-8),
    current_action: state.next_recommended_action,
    principles: state.principles,
    latest_message: cleanText(latestMessage),
  };
}

export async function requestModelJudgment({ endpoint, apiKey, model, context, fetchImpl = globalThis.fetch }) {
  if (!endpoint || !model || typeof fetchImpl !== "function") {
    return { available: false, reason: "model_not_configured" };
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是学程的判断增强层。只分析证据、候选行动、反方理由、不确定性和改判条件。不得宣称用户已掌握；不得绕过用户确认执行外部操作。" },
        { role: "user", content: JSON.stringify(context) },
      ],
      temperature: 0.35,
    }),
  });
  if (!response.ok) return { available: false, reason: `model_http_${response.status}` };
  const payload = await response.json();
  const content = cleanText(payload.choices?.[0]?.message?.content || payload.output_text);
  if (!content) return { available: false, reason: "model_empty_response" };
  return { available: true, content };
}
