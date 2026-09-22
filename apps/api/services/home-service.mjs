import { ApiError } from "../lib/http.mjs";

const ROLES = new Set(["guide", "friend", "family", "partner"]);
const GENDERS = new Set(["female", "male", "neutral"]);
const ACTION_STATUSES = new Set(["proposed", "accepted", "revised", "deferred"]);

const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const ratio = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback;
};
const cleanText = (value, maximum, field) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(422, "invalid_snapshot", `${field} 格式不正确。`);
  }
  return value.trim();
};
const optionalText = (value, maximum, field) => value == null || value === "" ? "" : cleanText(value, maximum, field);
const finiteNumber = (value, field, { min = 0, max = 1 } = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ApiError(422, "invalid_snapshot", `${field} 格式不正确。`);
  }
  return number;
};

function normalizeCalendarEvents(value) {
  if (!Array.isArray(value) || value.length > 200) {
    throw new ApiError(422, "invalid_snapshot", "calendar_events 最多只能包含 200 条日程。 ");
  }
  return value.map((event, index) => {
    if (!isObject(event)) throw new ApiError(422, "invalid_snapshot", `calendar_events[${index}] 格式不正确。`);
    return {
      id: optionalText(event.id, 80, `calendar_events[${index}].id`) || crypto.randomUUID(),
      summary: cleanText(event.summary, 140, `calendar_events[${index}].summary`),
      start: cleanText(event.start, 64, `calendar_events[${index}].start`),
      source: optionalText(event.source, 80, `calendar_events[${index}].source`),
      sourceActionId: optionalText(event.sourceActionId, 80, `calendar_events[${index}].sourceActionId`),
    };
  });
}

function normalizeGoals(value) {
  if (!Array.isArray(value) || value.length > 40) {
    throw new ApiError(422, "invalid_snapshot", "long_term_goals 格式不正确。 ");
  }
  return value.map((goal, index) => {
    if (!isObject(goal)) throw new ApiError(422, "invalid_snapshot", `long_term_goals[${index}] 格式不正确。`);
    return {
      id: optionalText(goal.id, 80, `long_term_goals[${index}].id`) || crypto.randomUUID(),
      text: cleanText(goal.text, 180, `long_term_goals[${index}].text`),
      status: optionalText(goal.status, 32, `long_term_goals[${index}].status`) || "confirmed",
      confidence: finiteNumber(goal.confidence ?? .5, `long_term_goals[${index}].confidence`),
    };
  });
}

function normalizeSkills(value) {
  if (!isObject(value) || Object.keys(value).length > 80) {
    throw new ApiError(422, "invalid_snapshot", "skills 格式不正确。 ");
  }
  return Object.fromEntries(Object.entries(value).map(([id, skill]) => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !isObject(skill)) {
      throw new ApiError(422, "invalid_snapshot", "skills 包含无效项目。 ");
    }
    const evidence = Array.isArray(skill.evidence) ? skill.evidence : [];
    if (evidence.length > 8 || evidence.some(item => typeof item !== "string" || item.trim().length > 180)) {
      throw new ApiError(422, "invalid_snapshot", `skills.${id}.evidence 格式不正确。`);
    }
    return [id, {
      label: cleanText(skill.label, 80, `skills.${id}.label`),
      confidence: finiteNumber(skill.confidence, `skills.${id}.confidence`),
      evidence: evidence.map(item => item.trim()),
    }];
  }));
}

function normalizeAction(value) {
  if (value == null) return null;
  if (!isObject(value)) throw new ApiError(422, "invalid_snapshot", "next_recommended_action 格式不正确。 ");
  const status = cleanText(value.status, 32, "next_recommended_action.status");
  if (!ACTION_STATUSES.has(status)) {
    throw new ApiError(422, "invalid_snapshot", "next_recommended_action.status 无效。 ");
  }
  return {
    id: cleanText(value.id, 80, "next_recommended_action.id"),
    title: cleanText(value.title, 160, "next_recommended_action.title"),
    why_now: cleanText(value.why_now, 360, "next_recommended_action.why_now"),
    duration_minutes: finiteNumber(value.duration_minutes, "next_recommended_action.duration_minutes", { min: 1, max: 360 }),
    platform: optionalText(value.platform, 80, "next_recommended_action.platform"),
    skill_id: optionalText(value.skill_id, 80, "next_recommended_action.skill_id"),
    status,
  };
}

export function normalizeHomeSnapshot(payload) {
  if (!isObject(payload) || !isObject(payload.preferences) || !isObject(payload.agent_state)) {
    throw new ApiError(422, "invalid_snapshot", "快照需要 preferences 和 agent_state。 ");
  }
  const preferences = payload.preferences;
  const agent = payload.agent_state;
  const role = cleanText(preferences.role, 32, "preferences.role");
  const gender = cleanText(preferences.gender, 32, "preferences.gender");
  if (!ROLES.has(role) || !GENDERS.has(gender)) {
    throw new ApiError(422, "invalid_snapshot", "伙伴关系或称谓设置无效。 ");
  }
  return {
    version: 1,
    saved_at: new Date().toISOString(),
    preferences: {
      name: cleanText(preferences.name, 24, "preferences.name"),
      avatar: optionalText(preferences.avatar, 512, "preferences.avatar"),
      role,
      gender,
      initiative: finiteNumber(preferences.initiative, "preferences.initiative"),
      directness: finiteNumber(preferences.directness, "preferences.directness"),
      calendar_events: normalizeCalendarEvents(preferences.calendar_events || []),
    },
    agent_state: {
      current_stage: optionalText(agent.current_stage, 80, "agent_state.current_stage"),
      long_term_goals: normalizeGoals(agent.long_term_goals || []),
      skills: normalizeSkills(agent.skills || {}),
      next_recommended_action: normalizeAction(agent.next_recommended_action),
    },
  };
}

export function mergeHomeSnapshot(existing, snapshot) {
  const existingPreferences = isObject(existing?.preferences) ? existing.preferences : {};
  const serverOwnsCalendar = existingPreferences.calendar_events_authority === "server";
  return {
    ...snapshot,
    preferences: {
      ...existingPreferences,
      ...snapshot.preferences,
      calendar_events: serverOwnsCalendar && Array.isArray(existingPreferences.calendar_events)
        ? existingPreferences.calendar_events
        : snapshot.preferences.calendar_events,
      ...(serverOwnsCalendar ? { calendar_events_authority: "server" } : {}),
    },
    conversations: Array.isArray(existing?.conversations) ? existing.conversations : [],
  };
}

function sortableStart(value) {
  const raw = String(value || "");
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6] || "00"}`;
  return raw;
}

export function buildHomeResponse(snapshot, now = new Date()) {
  const goals = snapshot.agent_state.long_term_goals;
  const skills = Object.entries(snapshot.agent_state.skills);
  const activeSkill = skills
    .filter(([, skill]) => skill.evidence.length)
    .sort(([, left], [, right]) => left.confidence - right.confidence)[0];
  const upcoming = [...snapshot.preferences.calendar_events]
    .sort((left, right) => sortableStart(left.start).localeCompare(sortableStart(right.start)))[0] || null;
  const action = snapshot.agent_state.next_recommended_action;
  return {
    version: "v1",
    generated_at: now.toISOString(),
    companion: {
      name: snapshot.preferences.name,
      avatar: snapshot.preferences.avatar || null,
      role: snapshot.preferences.role,
      gender: snapshot.preferences.gender,
    },
    next_step: action ? {
      ...action,
      is_confirmed_in_schedule: snapshot.preferences.calendar_events.some(event => event.sourceActionId === action.id),
    } : null,
    next_calendar_event: upcoming,
    path_summary: {
      direction: goals.find(goal => goal.status === "confirmed") || goals[0] || null,
      current_stage: snapshot.agent_state.current_stage || null,
      current_skill: activeSkill ? { id: activeSkill[0], ...activeSkill[1] } : null,
      evidence_count: skills.reduce((total, [, skill]) => total + skill.evidence.length, 0),
    },
  };
}

// This projection is only used after a verified user explicitly opens a remote session.
// It deliberately excludes the local-only avatar binary, model configuration, attachments,
// raw recordings, source materials and diagnostic history.
export function buildHomeSyncSnapshot(snapshot) {
  const preferences = isObject(snapshot?.preferences) ? snapshot.preferences : {};
  const agent = isObject(snapshot?.agent_state) ? snapshot.agent_state : {};
  return {
    preferences: {
      name: preferences.name || "小程",
      role: preferences.role || "guide",
      gender: preferences.gender || "female",
      initiative: ratio(preferences.initiative, .65),
      directness: ratio(preferences.directness, .55),
      theme: preferences.theme === "night" ? "night" : "day",
      cloud_consent: Boolean(preferences.cloud_consent),
      quiet_start: preferences.quiet_start || "23:00",
      quiet_end: preferences.quiet_end || "07:30",
      urgent_override: preferences.urgent_override !== false,
      calendar_events: Array.isArray(preferences.calendar_events) ? preferences.calendar_events.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        duration_minutes: event.duration_minutes || null,
        source: event.source || "manual",
        sourceActionId: event.sourceActionId || null,
        status: event.status || "confirmed",
        updated_at: event.updated_at || null,
      })) : [],
    },
    agent_state: {
      current_stage: agent.current_stage || "",
      long_term_goals: Array.isArray(agent.long_term_goals) ? agent.long_term_goals : [],
      skills: isObject(agent.skills) ? agent.skills : {},
      next_recommended_action: agent.next_recommended_action || null,
    },
  };
}
