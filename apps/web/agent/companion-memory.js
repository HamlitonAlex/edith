const short = (value, limit = 240) => String(value || "").trim().slice(0, limit);

// A narrow, explainable candidate detector. It proposes; it never confirms.
export function memoryCandidateFromMessage(text, existing = []) {
  const content = short(text, 220).replace(/[。！!\s]+$/, "");
  if (!/^(?:我(?:以后|将来|未来|长期)(?:想|希望|打算)|我的长期目标是|我希望以后)/.test(content)) return null;
  if (content.length < 12 || /[？?]/.test(content)) return null;
  if (existing.some(item => item.status !== "archived" && item.content === content)) return null;
  return { type: "long_term", content, topic: "长期方向", source_type: "conversation" };
}

const confirmed = item => item?.status === "confirmed" && item.confirmed_by_user === true && !item.archived_at;

/** One local, evidence-grounded action; never a task list or a claim of mastery. */
export function contextualNextStep({ memories = [], evidence = [], dailyLogs = [], today = {}, currentAction = null } = {}) {
  if (currentAction?.status === "accepted" || currentAction?.status === "pending") return currentAction;
  const goal = memories.filter(confirmed).filter(item => item.type === "long_term").at(-1);
  if (!goal) return null;
  const recentLog = dailyLogs.filter(confirmed).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const related = evidence.filter(item => item?.topic && item?.result && !item.deleted_at);
  const grouped = new Map();
  for (const item of related) {
    const key = short(item.topic, 80);
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  const weakness = [...grouped.entries()].filter(([, items]) => new Set(items
    .filter(item => /wrong_answer|incorrect_answer|tutor_observation/.test(item.evidence_type))
    .map(item => item.source_id || item.id)).size >= 2)
    .sort((a, b) => b[1].length - a[1].length)[0];
  const minutes = Math.max(8, Math.min(25, Number(today.available_minutes) || 20));
  const topic = weakness?.[0] || short(recentLog?.tomorrow_plan, 48) || null;
  const title = weakness ? `用一道小题复现“${topic}”` : topic ? `推进“${topic}”的一小步` : `为“${short(goal.content, 40)}”做一次小练习`;
  const why = weakness
    ? `最近至少两次练习在“${topic}”留下了相似困难，先用一道题确认卡点。`
    : recentLog?.tomorrow_plan
      ? `你确认的最近学习记录把“${topic}”列为下一步。`
      : `这是你亲自确认的长期方向；先做一件可检验的小事，不预设你已经掌握。`;
  return {
    id: `memory-next-${goal.id}-${weakness ? short(topic, 32) : recentLog?.id || "goal"}`,
    title, why_now: why, duration_minutes: minutes, platform: "学程 · 对话", status: "proposed",
    skill_id: "self_direction", source_memory_id: goal.id,
    instructions: weakness ? `先独立完成一道有关“${topic}”的小题，再说出卡在哪里。` : "选一个最小练习，独立试做并记录遇到的具体问题。",
    completion_criteria: "留下实际尝试、结果与下一次要调整的一点。",
  };
}

/** Only the bounded Context Builder output crosses the model boundary. */
export function modelInputFromContext(context, userContent, baseSystem) {
  const safe = context && typeof context === "object" ? context : {};
  const messages = (Array.isArray(safe.recent_conversation) ? safe.recent_conversation : [])
    .filter(item => ["user", "assistant"].includes(item.role))
    .map(item => ({ role: item.role, content: short(item.content || item.text, 640) }))
    .filter(item => item.content);
  messages.push({ role: "user", content: userContent });
  const facts = {
    profile: safe.current_user || null,
    confirmed_memory: safe.relevant_memory || [],
    learning_evidence: safe.relevant_learning_evidence || [],
    today: safe.today_state || null,
    current_task: safe.current_task || null,
  };
  return {
    system: `${baseSystem}\n仅参考以下有界上下文；证据不等于已经掌握，不要编造未提供的经历：${JSON.stringify(facts)}`,
    messages,
    sources: {
      memory: (safe.relevant_memory || []).map(item => item.id).filter(Boolean),
      evidence: (safe.relevant_learning_evidence || []).map(item => item.id).filter(Boolean),
      recent_messages: messages.length - 1,
    },
  };
}
