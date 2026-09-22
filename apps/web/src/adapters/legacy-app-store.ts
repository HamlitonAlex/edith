const preferencesKey = "xuecheng:iphone:v2";
const agentKey = "xuecheng:agent:v1";

export interface LegacyMessage {
  id?: string;
  clientMessageId?: string;
  createdAt?: string;
  role?: "assistant" | "user";
  source?: string;
  text?: string;
}

export interface LegacyCalendarEvent {
  id?: string;
  summary?: string;
  start?: string;
  end?: string;
  status?: "confirmed" | "pending" | "completed";
  sourceActionId?: string;
}

export interface LegacyAction {
  id?: string;
  title?: string;
  why_now?: string;
  duration_minutes?: number;
  platform?: string;
  status?: "accepted" | "pending" | "completed";
  skill_id?: string;
}

export interface LegacyAppSnapshot {
  preferences: {
    name: string;
    role: string;
    theme: "day" | "night";
    quietStart: string;
    quietEnd: string;
    messages: LegacyMessage[];
    calendarEvents: LegacyCalendarEvent[];
  };
  agent: {
    long_term_goals: Array<{ text?: string }>;
    skills: Record<string, { label?: string; confidence?: number; evidence?: string[] }>;
    next_recommended_action: LegacyAction | null;
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parse(key: string): Record<string, unknown> {
  try { return object(JSON.parse(window.localStorage.getItem(key) || "{}")); }
  catch { return {}; }
}

/**
 * Read-only bridge to the production local-first documents. React screens may
 * shape this data for presentation, but updates remain owned by the existing
 * repository and legacy application until each behaviour is migrated.
 */
export function readLegacyAppSnapshot(): LegacyAppSnapshot {
  const preferences = parse(preferencesKey);
  const agent = parse(agentKey);
  const nextAction = object(agent.next_recommended_action);
  return {
    preferences: {
      name: typeof preferences.name === "string" && preferences.name.trim() ? preferences.name.trim() : "小程",
      role: typeof preferences.role === "string" ? preferences.role : "guide",
      theme: preferences.theme === "night" ? "night" : "day",
      quietStart: typeof preferences.quietStart === "string" ? preferences.quietStart : "23:00",
      quietEnd: typeof preferences.quietEnd === "string" ? preferences.quietEnd : "07:30",
      messages: Array.isArray(preferences.messages) ? preferences.messages as LegacyMessage[] : [],
      calendarEvents: Array.isArray(preferences.calendarEvents) ? preferences.calendarEvents as LegacyCalendarEvent[] : [],
    },
    agent: {
      long_term_goals: Array.isArray(agent.long_term_goals) ? agent.long_term_goals as Array<{ text?: string }> : [],
      skills: object(agent.skills) as LegacyAppSnapshot["agent"]["skills"],
      next_recommended_action: Object.keys(nextAction).length ? nextAction as LegacyAction : null,
    },
  };
}
