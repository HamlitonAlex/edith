const DEFAULT_MAX_CHARS = 12000;
const MAX_INPUT_CHARS = 4000;
const MAX_MESSAGE_CHARS = 640;
const MAX_MEMORY_CONTENT_CHARS = 480;
const MAX_EVIDENCE_RESULT_CHARS = 560;
const MAX_MESSAGES = 12;
const MAX_MEMORY_ITEMS = 20;
const MAX_EVIDENCE_ITEMS = 20;
const ALLOWED_EVIDENCE_TYPES = new Set([
  "exercise_completed", "correct_answer", "wrong_answer", "tutor_verification", "self_assessment", "project_completed", "exam_result",
  "incorrect_answer", "practice_completed", "assessment", "user_self_report", "tutor_observation",
  "explanation", "independent_solution", "transfer", "correction",
]);

const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = value => Array.isArray(value) ? value : [];

function clean(value, maximum = 2000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function boundedNumber(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function dateValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : null;
}

function identityOf(value, { allowOwnId = false } = {}) {
  const source = asObject(value);
  // Records themselves also have an `id`; it is never an owner identifier.
  // Only the current-user boundary may explicitly opt into a bare `id`.
  return clean(source.user_id ?? source.userId ?? source.subject ?? asObject(source.user).id ?? (allowOwnId ? source.id : null), 160) || null;
}

function belongsToUser(value, userId) {
  const owner = identityOf(value);
  // A local-first record may be intentionally unscoped until login. Once an
  // owner is supplied, an explicitly different owner is never allowed in.
  return !userId || !owner || owner === userId;
}

function isDeleted(value) {
  const source = asObject(value);
  return source.deleted === true
    || source.is_deleted === true
    || Boolean(clean(source.deleted_at, 64))
    || clean(source.status, 24) === "deleted";
}

function sourceReference(value) {
  const source = asObject(value);
  const type = clean(source.source_type || asObject(source.source).type, 40) || null;
  const id = clean(source.source_id || asObject(source.source).id, 160) || null;
  return type || id ? { type, id } : null;
}

function isConfirmedProfileItem(value) {
  const source = asObject(value);
  // Primitive values are accepted only as a caller-provided confirmed profile
  // projection. Structured items must carry explicit user confirmation.
  if (!Object.keys(source).length) return true;
  return clean(source.status, 24) === "confirmed" && source.confirmed_by_user === true;
}

function confirmedProfileText(value, maximum) {
  if (!isConfirmedProfileItem(value)) return "";
  const source = asObject(value);
  return clean(source.statement || source.text || source.content || source.label || value, maximum);
}

function profileProjection(value) {
  const source = asObject(value);
  const companion = asObject(source.companion || source);
  const appearance = asObject(source.appearance);
  const compactItems = (items, maximum) => asArray(items)
    .map(item => confirmedProfileText(item, maximum))
    .filter(Boolean)
    .slice(0, 12);
  return {
    name: clean(companion.name || source.name || "小程", 80),
    role: clean(companion.role || source.role || "guide", 40),
    gender: clean(companion.gender || source.gender || "neutral", 40),
    initiative: boundedNumber(companion.initiative ?? source.initiative, 0.65),
    directness: boundedNumber(companion.directness ?? source.directness, 0.55),
    theme: clean(appearance.theme || source.theme || "day", 16),
    current_stage: confirmedProfileText(source.current_stage || source.stage, 240) || null,
    long_term_goals: compactItems(source.confirmed_directions || source.long_term_goals || source.goals, 400),
    interests: compactItems(source.interests, 160),
  };
}

function messageProjection(value) {
  const source = asObject(value);
  const role = source.role === "assistant" ? "assistant" : "user";
  const text = clean(source.text, MAX_MESSAGE_CHARS);
  if (!text) return null;
  return {
    id: clean(source.id || source.client_message_id, 128) || null,
    role,
    text,
    occurred_at: clean(source.occurred_at || source.createdAt, 64) || null,
  };
}

function taskProjection(value, userId) {
  const source = asObject(value);
  if (!Object.keys(source).length || !belongsToUser(source, userId) || isDeleted(source)) return null;
  return {
    id: clean(source.id, 128) || null,
    title: clean(source.title || source.next_action, 240),
    why_now: clean(source.why_now, 600),
    duration_minutes: Number.isFinite(Number(source.duration_minutes)) ? Number(source.duration_minutes) : null,
    platform: clean(source.platform, 80) || null,
    skill_id: clean(source.skill_id, 120) || null,
    status: clean(source.status, 40) || null,
  };
}

function memoryProjection(value, userId) {
  const source = asObject(value);
  const status = clean(source.status, 24);
  if (!belongsToUser(source, userId) || isDeleted(source) || status !== "confirmed" || source.confirmed_by_user !== true || source.archived_at) return null;
  const content = clean(source.content || source.text, MAX_MEMORY_CONTENT_CHARS);
  if (!content) return null;
  return {
    id: clean(source.id, 128) || null,
    type: clean(source.type || source.kind, 32) || "recent_event",
    content,
    topic: clean(source.topic, 160) || null,
    // `source` is deliberately never coerced to text: it may carry a raw
    // private payload from an older local store. Only an explicit structured
    // source_type and the short id/type reference are allowed into context.
    source_type: clean(source.source_type, 40) || null,
    source: sourceReference(source),
    confidence: boundedNumber(source.confidence, 0.5),
    importance: boundedNumber(source.importance, 0.5),
    created_at: clean(source.created_at || source.at, 64) || null,
  };
}

function proposedMemoryProjection(value, userId) {
  const source = asObject(value);
  if (!belongsToUser(source, userId) || isDeleted(source) || source.archived_at || clean(source.status, 24) !== "proposed") return null;
  const content = clean(source.content || source.text, MAX_MEMORY_CONTENT_CHARS);
  if (!content) return null;
  return {
    id: clean(source.id, 128) || null,
    type: clean(source.type || source.kind, 32) || "recent_event",
    content,
    topic: clean(source.topic, 160) || null,
    source_type: clean(source.source_type, 40) || null,
    source: sourceReference(source),
    confidence: boundedNumber(source.confidence, 0.5),
    importance: boundedNumber(source.importance, 0.5),
    created_at: clean(source.created_at || source.at, 64) || null,
  };
}

function evidenceProjection(value, userId) {
  const source = asObject(value);
  const topic = clean(source.topic, 160);
  const skill = clean(source.skill, 160);
  const result = clean(source.result, MAX_EVIDENCE_RESULT_CHARS);
  const evidenceType = clean(source.evidence_type, 48);
  if (!belongsToUser(source, userId) || isDeleted(source) || !topic || !skill || !result || !ALLOWED_EVIDENCE_TYPES.has(evidenceType)) return null;
  return {
    id: clean(source.id, 128) || null,
    topic,
    skill,
    evidence_type: evidenceType,
    result,
    score: source.score == null || !Number.isFinite(Number(source.score)) ? null : Number(source.score),
    source_type: clean(source.source_type, 40),
    source: sourceReference(source),
    confidence: boundedNumber(source.confidence, 0.5),
    created_at: clean(source.created_at, 64) || null,
  };
}

function relevance(item, topic, now) {
  const normalizedTopic = clean(topic, 160).toLowerCase();
  const itemTopic = clean(item.topic, 160).toLowerCase();
  const content = clean(item.content || item.result, 1200).toLowerCase();
  const topicMatch = normalizedTopic && (itemTopic.includes(normalizedTopic) || content.includes(normalizedTopic)) ? 1 : 0;
  const createdAt = dateValue(item.created_at);
  const ageDays = createdAt == null ? 365 : Math.max(0, (now - createdAt) / 86_400_000);
  const recency = Math.max(0, 1 - Math.min(ageDays, 365) / 365);
  return topicMatch * 4 + boundedNumber(item.importance ?? item.confidence, 0.5) * 2 + recency;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableKey(value) {
  return [value.id, value.type, value.topic, value.content || value.result, value.source?.id]
    .map(part => clean(part, 1200))
    .join("\u0000");
}

function sortedRelevant(values, topic, now, limit) {
  return values
    .map((value, index) => ({ value, index, score: relevance(value, topic, now) }))
    .sort((left, right) => right.score - left.score
      || (dateValue(right.value.created_at) ?? 0) - (dateValue(left.value.created_at) ?? 0)
      || compareText(stableKey(left.value), stableKey(right.value))
      || left.index - right.index)
    .slice(0, limit)
    .map(item => item.value);
}

function normalizeConversation(value, userId) {
  const source = Array.isArray(value) ? { messages: value } : asObject(value);
  const allowed = belongsToUser(source, userId);
  const messages = allowed
    ? asArray(source.messages)
      .filter(message => belongsToUser(message, userId) && !isDeleted(message))
      .map(messageProjection)
      .filter(Boolean)
      .sort((left, right) => (dateValue(left.occurred_at) ?? 0) - (dateValue(right.occurred_at) ?? 0)
        || compareText(left.id || "", right.id || ""))
      .slice(-MAX_MESSAGES)
    : [];
  const currentInput = allowed ? clean(source.current_input || source.latest_message, MAX_INPUT_CHARS) : "";
  return { messages, current_input: currentInput };
}

function listText(value, maximum = 2000) {
  if (Array.isArray(value)) return value.map(item => clean(item, 400)).filter(Boolean).slice(-20);
  const text = clean(value, maximum);
  return text ? [text] : [];
}

function dailyLogProjection(value, userId) {
  const source = asObject(value);
  if (!Object.keys(source).length || !belongsToUser(source, userId) || isDeleted(source) || clean(source.status, 24) !== "confirmed" || source.confirmed_by_user !== true) return null;
  return {
    date: clean(source.date, 16) || null,
    completed: listText(source.completed),
    problems: listText(source.problems),
    learned: listText(source.learned),
    tomorrow_plan: clean(source.tomorrow_plan, 1200),
    ai_summary: clean(source.ai_summary, 1600),
    status: "confirmed",
  };
}

function compactTodayState(value, dailyLog, userId) {
  const source = asObject(value);
  if (!belongsToUser(source, userId) || isDeleted(source)) {
    return { date: null, energy: "unknown", mood: null, available_minutes: null, goal: null, daily_log: null };
  }
  const currentState = asObject(source.current_state || source);
  return {
    date: clean(source.date, 16) || null,
    energy: clean(currentState.energy, 40) || "unknown",
    mood: clean(currentState.mood, 80) || null,
    available_minutes: Number.isFinite(Number(source.available_minutes)) ? Number(source.available_minutes) : null,
    goal: clean(source.goal || source.today_goal, 600) || null,
    daily_log: dailyLog,
  };
}

function clampBudget(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_MAX_CHARS;
  return Math.max(1200, Math.min(30_000, Math.floor(number)));
}

function serializedSize(value) {
  return JSON.stringify(value).length;
}

/**
 * Build a bounded, auditable context for the companion. The builder accepts
 * local or server projections but only confirmed memories can enter the
 * stable memory section. It never mutates the supplied state.
 */
export function buildAiContext({
  current_user,
  current_conversation,
  current_task,
  current_date,
  today_state,
  daily_log,
  memories,
  proposed_memories,
  learning_evidence,
  max_chars = DEFAULT_MAX_CHARS,
  now,
} = {}) {
  const budget = clampBudget(max_chars);
  const userId = identityOf(current_user, { allowOwnId: true });
  const profile = profileProjection(current_user);
  const conversation = normalizeConversation(current_conversation, userId);
  const currentInput = conversation.current_input;
  const task = taskProjection(current_task, userId);
  const topic = task?.title || currentInput;
  const effectiveNow = dateValue(now) ?? dateValue(`${clean(current_date, 16)}T12:00:00.000Z`) ?? 0;
  const confirmedMemories = sortedRelevant(asArray(memories).map(memory => memoryProjection(memory, userId)).filter(Boolean), topic, effectiveNow, MAX_MEMORY_ITEMS);
  const stableMemories = confirmedMemories.filter(memory => memory.type !== "recent_event");
  const recentEvents = confirmedMemories.filter(memory => memory.type === "recent_event");
  const proposals = sortedRelevant(asArray(proposed_memories).map(memory => proposedMemoryProjection(memory, userId)).filter(Boolean), topic, effectiveNow, 10);
  const evidence = sortedRelevant(asArray(learning_evidence).map(item => evidenceProjection(item, userId)).filter(Boolean), topic, effectiveNow, MAX_EVIDENCE_ITEMS);
  const log = dailyLogProjection(daily_log || asObject(today_state).daily_log, userId);
  const today = compactTodayState({ ...asObject(today_state), date: current_date || asObject(today_state).date }, log, userId);
  const systemInstructions = [
    "你是学程的小程：长期成长伙伴，不把猜测说成事实。",
    "只使用当前上下文和已确认的结构化证据；需要确认的内容保持为提议。",
    "不要把聊天、提问或任务完成自动等同于掌握；表达不确定性并保留用户最终决定权。",
  ];

  // Profile details and today's confirmed log are intentionally staged below:
  // they are lower priority than the live user turn and current task.
  const compactProfile = { ...profile, current_stage: null, long_term_goals: [], interests: [] };
  const compactToday = { ...today, goal: null, daily_log: null };
  const output = {
    schema_version: 1,
    budget_chars: budget,
    system_instructions: systemInstructions,
    current_user: compactProfile,
    current_input: currentInput,
    current_task: null,
    current_date: clean(current_date, 16) || null,
    today_state: compactToday,
    relevant_memory: [],
    relevant_learning_evidence: [],
    recent_conversation: [],
    proposed_memories: [],
    truncation: {
      omitted_memory: 0, omitted_evidence: 0, omitted_messages: 0, omitted_proposals: 0,
      omitted_profile: 0, omitted_today_state: 0, omitted_task: 0, omitted_chars: 0,
    },
  };

  const trimInputToBudget = () => {
    while (serializedSize(output) > budget && output.current_input) {
      const overflow = serializedSize(output) - budget;
      const nextLength = Math.max(0, output.current_input.length - Math.max(overflow, 1));
      output.truncation.omitted_chars += output.current_input.length - nextLength;
      output.current_input = output.current_input.slice(0, nextLength);
    }
  };
  trimInputToBudget();

  const setIfFits = (target, key, value, omittedKey) => {
    const prior = target[key];
    target[key] = value;
    if (serializedSize(output) <= budget) return true;
    target[key] = prior;
    output.truncation[omittedKey] += 1;
    return false;
  };

  const add = (key, values, omittedKey) => {
    for (const value of values) {
      output[key].push(value);
      if (serializedSize(output) > budget) {
        output[key].pop();
        output.truncation[omittedKey] += 1;
      }
    }
  };

  const addProfileItems = (key, values) => {
    for (const value of values) {
      output.current_user[key].push(value);
      if (serializedSize(output) > budget) {
        output.current_user[key].pop();
        output.truncation.omitted_profile += 1;
      }
    }
  };

  // Priority is fixed and auditable: live user input, task and today's live
  // constraint; then conversation, confirmed memory, evidence, stable profile,
  // recent events, and finally pending confirmation prompts.
  if (task) setIfFits(output, "current_task", task, "omitted_task");
  if (today.goal) setIfFits(output.today_state, "goal", today.goal, "omitted_today_state");
  add("recent_conversation", conversation.messages, "omitted_messages");
  add("relevant_memory", stableMemories, "omitted_memory");
  add("relevant_learning_evidence", evidence, "omitted_evidence");
  if (profile.current_stage) setIfFits(output.current_user, "current_stage", profile.current_stage, "omitted_profile");
  addProfileItems("long_term_goals", profile.long_term_goals);
  addProfileItems("interests", profile.interests);
  if (today.daily_log) setIfFits(output.today_state, "daily_log", today.daily_log, "omitted_today_state");
  add("relevant_memory", recentEvents, "omitted_memory");
  add("proposed_memories", proposals, "omitted_proposals");

  // Counters can grow by one character (for example 9 → 10), so make one
  // final deterministic pass to keep even the audit metadata within budget.
  const pop = (key, omittedKey) => {
    output[key].pop();
    output.truncation[omittedKey] += 1;
  };
  while (serializedSize(output) > budget) {
    const lastMemory = output.relevant_memory.at(-1);
    if (output.proposed_memories.length) pop("proposed_memories", "omitted_proposals");
    else if (lastMemory?.type === "recent_event") pop("relevant_memory", "omitted_memory");
    else if (output.today_state.daily_log) setIfFits(output.today_state, "daily_log", null, "omitted_today_state");
    else if (output.current_user.interests.length) { output.current_user.interests.pop(); output.truncation.omitted_profile += 1; }
    else if (output.current_user.long_term_goals.length) { output.current_user.long_term_goals.pop(); output.truncation.omitted_profile += 1; }
    else if (output.current_user.current_stage) setIfFits(output.current_user, "current_stage", null, "omitted_profile");
    else if (output.relevant_learning_evidence.length) pop("relevant_learning_evidence", "omitted_evidence");
    else if (output.relevant_memory.length) pop("relevant_memory", "omitted_memory");
    else if (output.recent_conversation.length) pop("recent_conversation", "omitted_messages");
    else if (output.today_state.goal) setIfFits(output.today_state, "goal", null, "omitted_today_state");
    else if (output.current_task) setIfFits(output, "current_task", null, "omitted_task");
    else if (output.current_input) trimInputToBudget();
    else break;
  }
  return output;
}

export function buildContext(input = {}) {
  return buildAiContext(input);
}

export function buildContextFromAgentState({ agentState = {}, latestMessage = "", currentTask, currentDate, todayState, maxChars } = {}) {
  const state = asObject(agentState);
  return buildAiContext({
    current_user: {
      name: "小程",
      role: "guide",
      current_stage: state.current_stage,
      long_term_goals: asArray(state.long_term_goals).map(goal => clean(goal?.text, 400)).filter(Boolean),
      interests: asArray(state.interests).map(item => clean(item?.text || item, 200)).filter(Boolean),
    },
    current_conversation: { current_input: latestMessage, messages: [] },
    current_task: currentTask || state.next_recommended_action,
    current_date: currentDate,
    today_state: todayState || { current_state: state.current_state, goal: state.current_stage },
    memories: asArray(state.memory).map(item => ({
      ...item,
      status: item.status,
      type: item.type || item.kind || "recent_event",
      content: item.content || item.text,
      created_at: item.created_at || item.at,
    })),
    proposed_memories: asArray(state.memory)
      .filter(item => item?.status === "recorded" || item?.status === "proposed")
      .map(item => ({
        ...item,
        status: "proposed",
        type: item.type || item.kind || "recent_event",
        content: item.content || item.text,
        created_at: item.created_at || item.at,
      })),
    learning_evidence: asArray(state.learning_results).map(result => ({
      id: result.id,
      topic: result.topic || "学习内容",
      skill: result.domain || "general",
      evidence_type: result.evidence_type || "tutor_verification",
      result: result.learned || result.result || "学习结果已记录",
      source_type: "tutor",
      confidence: result.confidence,
      created_at: result.at,
    })),
    max_chars: maxChars,
  });
}

export { DEFAULT_MAX_CHARS };
