const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const asText = (value, maximum) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : "";

export const EXPLICIT_SYNC_POLICY = Object.freeze({
  mode: "explicit_only",
  allowed: Object.freeze(["home_snapshot", "profile_settings", "calendar_events", "conversation_text_messages"]),
  neverAutomatic: Object.freeze(["model_api_keys", "raw_audio", "attachments", "avatar_binary", "source_materials", "diagnostic_logs"]),
  localMigration: "requires_user_confirmation",
});

function safeEvents(value) {
  return Array.isArray(value) ? value.slice(0, 200).map(event => ({
    id: asText(event?.id, 80),
    summary: asText(event?.summary, 140),
    start: asText(event?.start, 64),
    ...(Number.isInteger(event?.duration_minutes) ? { duration_minutes: event.duration_minutes } : {}),
    source: asText(event?.source, 80),
    sourceActionId: asText(event?.sourceActionId || event?.source_action_id, 80),
  })).filter(event => event.summary && event.start) : [];
}

function safeGoals(value) {
  return Array.isArray(value) ? value.slice(0, 40).map(goal => ({
    id: asText(goal?.id, 80), text: asText(goal?.text, 180), status: asText(goal?.status, 32) || "confirmed",
    confidence: Number.isFinite(goal?.confidence) ? goal.confidence : .5,
  })).filter(goal => goal.text) : [];
}

function safeSkills(value) {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 80).flatMap(([id, skill]) => {
    const label = asText(skill?.label, 80);
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !label) return [];
    return [[id, {
      label,
      confidence: Number.isFinite(skill?.confidence) ? skill.confidence : 0,
      evidence: Array.isArray(skill?.evidence) ? skill.evidence.slice(0, 8).map(item => asText(item, 180)).filter(Boolean) : [],
    }]];
  }));
}

export function createExplicitHomeSyncPayload({ preferences, agentState }) {
  const safePreferences = isObject(preferences) ? preferences : {};
  const safeAgent = isObject(agentState) ? agentState : {};
  const action = isObject(safeAgent.next_recommended_action) ? safeAgent.next_recommended_action : null;
  return {
    preferences: {
      name: asText(safePreferences.name, 24) || "小程",
      avatar: "",
      role: asText(safePreferences.role, 32) || "guide",
      gender: asText(safePreferences.gender, 32) || "female",
      initiative: Number.isFinite(safePreferences.initiative) ? safePreferences.initiative : .65,
      directness: Number.isFinite(safePreferences.directness) ? safePreferences.directness : .55,
      calendar_events: safeEvents(safePreferences.calendarEvents),
    },
    agent_state: {
      current_stage: asText(safeAgent.current_stage, 80),
      long_term_goals: safeGoals(safeAgent.long_term_goals),
      skills: safeSkills(safeAgent.skills),
      next_recommended_action: action ? {
        id: asText(action.id, 80), title: asText(action.title, 160), why_now: asText(action.why_now, 360),
        duration_minutes: Number.isInteger(action.duration_minutes) ? action.duration_minutes : 15,
        platform: asText(action.platform, 80), skill_id: asText(action.skill_id, 80), status: asText(action.status, 32) || "proposed",
      } : null,
    },
  };
}

export async function syncHomeExplicitly({ fetchImpl = globalThis.fetch, apiBase, accessToken, snapshot, version }) {
  if (!accessToken) return { ok: false, reason: "not_authenticated", local_mutated: false };
  try {
    const response = await fetchImpl(`${String(apiBase || "").replace(/\/$/, "")}/api/v1/home`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...(version == null ? {} : { "if-match": String(version) }),
      },
      body: JSON.stringify(snapshot),
    });
    if (response.status === 409 || response.status === 428) return { ok: false, reason: "conflict", local_mutated: false };
    if (!response.ok) return { ok: false, reason: "server_error", local_mutated: false };
    return { ok: true, local_mutated: false, remote: await response.json() };
  } catch {
    return { ok: false, reason: "network_error", local_mutated: false };
  }
}
