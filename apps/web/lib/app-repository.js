import { createExplicitHomeSyncPayload } from "./explicit-sync.js";
import { RemoteApiError } from "./remote-api.js";

const messageIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,99}$/;
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asDate(value) {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function fingerprint(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// Existing local history did not have transport IDs. This deterministic ID is
// persisted on the next save so retries remain idempotent across refreshes.
export function clientMessageId(message, index = 0) {
  if (messageIdPattern.test(String(message?.clientMessageId || ""))) return message.clientMessageId;
  // Server records use their durable `id`; retain it when merging pages so a
  // later explicit sync cannot turn an already-persisted message into a new one.
  if (messageIdPattern.test(String(message?.id || ""))) return message.id;
  return `msg_${fingerprint(`${message?.role || "user"}|${message?.createdAt || ""}|${message?.text || ""}|${index}`)}`;
}

export function profilePatchFromLocal(preferences) {
  const source = object(preferences);
  return {
    name: source.name || "小程",
    role: source.role || "guide",
    gender: source.gender || "female",
    initiative: Number.isFinite(source.initiative) ? source.initiative : .65,
    directness: Number.isFinite(source.directness) ? source.directness : .55,
    theme: source.theme === "night" ? "night" : "day",
    cloud_consent: Boolean(source.cloudConsent),
    quiet_start: source.quietStart || "23:00",
    quiet_end: source.quietEnd || "07:30",
    urgent_override: source.urgentOverride !== false,
  };
}

function localPreferencesFromRemote(local, remote) {
  const remotePreferences = object(remote);
  return {
    ...local,
    ...["name", "role", "gender", "initiative", "directness"].reduce((next, key) => (Object.hasOwn(remotePreferences, key) ? { ...next, [key]: remotePreferences[key] } : next), {}),
    theme: remotePreferences.theme === "night" ? "night" : "day",
    cloudConsent: Boolean(remotePreferences.cloud_consent),
    quietStart: remotePreferences.quiet_start || local.quietStart,
    quietEnd: remotePreferences.quiet_end || local.quietEnd,
    urgentOverride: remotePreferences.urgent_override !== false,
    calendarEvents: Array.isArray(remotePreferences.calendar_events) ? remotePreferences.calendar_events : local.calendarEvents,
  };
}

export function mergeRemoteHome({ preferences, agentState }, response) {
  const snapshot = object(response?.data?.sync_snapshot);
  if (!snapshot.preferences || !snapshot.agent_state) return { preferences, agentState, applied: false };
  const remoteAgent = object(snapshot.agent_state);
  return {
    preferences: localPreferencesFromRemote(preferences, snapshot.preferences),
    agentState: {
      ...agentState,
      current_stage: remoteAgent.current_stage || "",
      long_term_goals: Array.isArray(remoteAgent.long_term_goals) ? remoteAgent.long_term_goals : [],
      skills: object(remoteAgent.skills),
      next_recommended_action: remoteAgent.next_recommended_action || null,
    },
    applied: true,
  };
}

export function mergeRemoteMessages(localMessages, remoteMessages) {
  const records = new Map();
  [...(Array.isArray(localMessages) ? localMessages : []), ...(Array.isArray(remoteMessages) ? remoteMessages : [])].forEach((message, index) => {
    const id = clientMessageId(message, index);
    const existing = records.get(id);
    const candidate = {
      ...existing,
      ...message,
      clientMessageId: id,
      createdAt: message.createdAt || message.occurred_at || existing?.createdAt || new Date().toISOString(),
      source: message.source || existing?.source || (message.role === "assistant" ? "local_agent" : "typing"),
    };
    records.set(id, candidate);
  });
  return [...records.values()].sort((left, right) => asDate(left.createdAt) - asDate(right.createdAt));
}

export async function accountScopeFor(identity, cryptoImpl = globalThis.crypto) {
  const raw = `${identity?.issuer || ""}|${identity?.subject || ""}`;
  if (!raw || raw === "|") return "anonymous";
  if (!cryptoImpl?.subtle) return `account-${fingerprint(raw)}`;
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return `account-${[...new Uint8Array(digest)].slice(0, 12).map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

export function createAppRepository({ auth, api, now = () => new Date() } = {}) {
  let remoteVersion = null;
  let syncStatus = "local";
  let lastSyncedAt = null;
  let lastError = null;

  const snapshot = () => ({ remoteVersion, syncStatus, lastSyncedAt, lastError });
  const set = update => {
    if (Object.hasOwn(update, "remoteVersion")) remoteVersion = update.remoteVersion;
    if (Object.hasOwn(update, "syncStatus")) syncStatus = update.syncStatus;
    if (Object.hasOwn(update, "lastSyncedAt")) lastSyncedAt = update.lastSyncedAt;
    if (Object.hasOwn(update, "lastError")) lastError = update.lastError;
    return snapshot();
  };
  const authenticated = () => Boolean(auth?.getState?.().authenticated);
  const noteError = error => {
    if (error instanceof RemoteApiError) {
      if (error.status === 401) return set({ syncStatus: "needs_login", lastError: error.code });
      if (error.status === 403) return set({ syncStatus: "forbidden", lastError: error.code });
      if (error.status === 409 || error.status === 428) return set({ syncStatus: "conflict", lastError: error.code });
      if (error.status === 503) return set({ syncStatus: "service_unavailable", lastError: error.code });
    }
    return set({ syncStatus: "failed", lastError: error?.code || "network_error" });
  };

  async function readRemote({ preferences, agentState, messages, localDirty = false } = {}) {
    if (!authenticated()) return { ...snapshot(), preferences, agentState, messages, applied: false };
    set({ syncStatus: "loading", lastError: null });
    try {
      const [home, profile, conversation] = await Promise.all([
        api.getHome().catch(error => error?.status === 404 ? null : Promise.reject(error)),
        api.getProfile(),
        api.listMessages("main", { limit: 100 }).catch(error => error?.status === 404 ? null : Promise.reject(error)),
      ]);
      if (home) remoteVersion = home.version ?? home.meta?.data_version ?? remoteVersion;
      else remoteVersion = profile.version ?? profile.meta?.data_version ?? remoteVersion;
      if (localDirty && home && remoteVersion != null) {
        return { ...set({ syncStatus: "conflict", lastError: "local_changes_pending" }), preferences, agentState, messages, applied: false };
      }
      const merged = home ? mergeRemoteHome({ preferences, agentState }, home) : { preferences, agentState, applied: false };
      const mergedPreferences = localPreferencesFromRemote(merged.preferences, {
        ...object(home?.data?.sync_snapshot?.preferences),
        name: profile.data?.companion?.name,
        role: profile.data?.companion?.role,
        gender: profile.data?.companion?.gender,
        initiative: profile.data?.companion?.initiative,
        directness: profile.data?.companion?.directness,
        theme: profile.data?.appearance?.theme,
        cloud_consent: profile.data?.privacy?.cloud_consent,
        quiet_start: profile.data?.notifications?.quiet_start,
        quiet_end: profile.data?.notifications?.quiet_end,
        urgent_override: profile.data?.notifications?.urgent_override,
      });
      const mergedMessages = conversation ? mergeRemoteMessages(messages, conversation.data?.messages) : messages;
      return { ...set({ syncStatus: home ? "synced" : "ready", lastError: null }), preferences: mergedPreferences, agentState: merged.agentState, messages: mergedMessages, applied: Boolean(home || conversation) };
    } catch (error) {
      return { ...noteError(error), preferences, agentState, messages, applied: false };
    }
  }

  async function syncAll({ preferences, agentState, messages }) {
    if (!authenticated()) return set({ syncStatus: "needs_login", lastError: "not_authenticated" });
    set({ syncStatus: "syncing", lastError: null });
    try {
      if (remoteVersion == null) {
        const remote = await api.getHome().catch(error => error?.status === 404 ? null : Promise.reject(error));
        remoteVersion = remote?.version ?? remote?.meta?.data_version ?? 0;
      }
      const home = await api.putHome(createExplicitHomeSyncPayload({ preferences, agentState }), remoteVersion || null);
      remoteVersion = home.version ?? home.meta?.data_version ?? remoteVersion;
      const profile = await api.patchProfile(profilePatchFromLocal(preferences), remoteVersion || null);
      remoteVersion = profile.version ?? profile.meta?.data_version ?? remoteVersion;
      for (const [index, message] of (Array.isArray(messages) ? messages : []).entries()) {
        if (!String(message?.text || "").trim()) continue;
        const id = clientMessageId(message, index);
        const response = await api.appendMessage("main", {
          client_message_id: id,
          role: message.role === "assistant" ? "assistant" : "user",
          text: String(message.text || "").trim(),
          source: message.source === "voice_transcript" ? "voice_transcript" : message.role === "assistant" ? "local_agent" : "typing",
          occurred_at: message.createdAt || now().toISOString(),
        });
        remoteVersion = response.version ?? response.meta?.data_version ?? remoteVersion;
      }
      return set({ syncStatus: "synced", lastSyncedAt: now().toISOString(), lastError: null });
    } catch (error) {
      return noteError(error);
    }
  }

  async function persistProfile(preferences) {
    if (!authenticated()) return set({ syncStatus: "local", lastError: null });
    set({ syncStatus: "syncing", lastError: null });
    try {
      const response = await api.patchProfile(profilePatchFromLocal(preferences), remoteVersion || null);
      remoteVersion = response.version ?? response.meta?.data_version ?? remoteVersion;
      return set({ syncStatus: "synced", lastSyncedAt: now().toISOString(), lastError: null });
    } catch (error) {
      return noteError(error);
    }
  }

  async function sendMessage(message, index = 0) {
    if (!authenticated()) return set({ syncStatus: "local", lastError: null });
    try {
      const response = await api.appendMessage("main", {
        client_message_id: clientMessageId(message, index),
        role: message.role === "assistant" ? "assistant" : "user",
        text: String(message.text || "").trim(),
        source: message.source === "voice_transcript" ? "voice_transcript" : message.role === "assistant" ? "local_agent" : "typing",
        occurred_at: message.createdAt || now().toISOString(),
      });
      remoteVersion = response.version ?? response.meta?.data_version ?? remoteVersion;
      return set({ syncStatus: "synced", lastSyncedAt: now().toISOString(), lastError: null });
    } catch (error) {
      return noteError(error);
    }
  }

  async function confirmScheduleSuggestion(suggestionId, input) {
    if (!authenticated()) return { ok: false, localOnly: true, state: set({ syncStatus: "local", lastError: null }) };
    try {
      const response = await api.confirmScheduleSuggestion(suggestionId, input, remoteVersion || null);
      remoteVersion = response.version ?? response.meta?.data_version ?? remoteVersion;
      return { ok: true, event: response.data.event, state: set({ syncStatus: "synced", lastSyncedAt: now().toISOString(), lastError: null }) };
    } catch (error) {
      return { ok: false, localOnly: false, state: noteError(error) };
    }
  }

  async function createScheduleEvent(input) {
    if (!authenticated()) return { ok: false, localOnly: true, state: set({ syncStatus: "local", lastError: null }) };
    try {
      const response = await api.createScheduleEvent(input, remoteVersion || null);
      remoteVersion = response.version ?? response.meta?.data_version ?? remoteVersion;
      return { ok: true, event: response.data.event, state: set({ syncStatus: "synced", lastSyncedAt: now().toISOString(), lastError: null }) };
    } catch (error) {
      return { ok: false, localOnly: false, state: noteError(error) };
    }
  }

  return { getState: snapshot, readRemote, syncAll, persistProfile, sendMessage, confirmScheduleSuggestion, createScheduleEvent, accountScopeFor: identity => accountScopeFor(identity) };
}
