import type { LegacyAppSnapshot } from "./legacy-app-store";

export type RuntimeVoiceState = "idle" | "requesting" | "recording" | "recognizing" | "success" | "failure" | "cancelled";
export interface RuntimeSnapshot extends LegacyAppSnapshot {
  sync: { title: string; detail: string };
  conversation: { status: string; sending: boolean };
  memoryPrompt?: { id: string; content: string; status: "proposed" | "confirmed" | "archived" } | null;
  contextDebug?: { memory: string[]; evidence: string[]; recent_messages: number } | null;
  remote: { status: string; lastSyncedAt: string | null };
  auth: { status: string; configured: boolean; authenticated: boolean };
  attachments: Array<{ name: string; type: string }>;
  calendarDate: string;
  modelProviders: Array<{ id: string; name: string; endpoint: string }>;
  modelKeyConfigured: boolean;
}

export interface LegacyRuntimePort {
  getSnapshot: () => RuntimeSnapshot;
  sendMessage: (text: string) => boolean;
  confirmMemory: (id: string) => boolean;
  dismissMemory: (id: string) => boolean;
  startVoice: () => boolean;
  stopVoice: () => void;
  cancelVoice: () => void;
  acceptAction: () => void;
  discussAction: (text?: string) => void;
  confirmSuggestion: () => void;
  rejectSuggestion: () => void;
  setProfile: (patch: Record<string, unknown>) => void;
  setTheme: (theme: "day" | "night") => void;
  setQuietHours: (start: string, end: string) => void;
  syncNow: () => void;
  beginLogin: () => void;
  createSchedule: (summary: string, start: string) => void;
  importCalendar: () => void;
  chooseAttachment: (source?: "photo" | "camera" | "file") => void;
  removeAttachment: (index: number) => void;
  addPastedText: (text: string) => void;
  chooseAvatar: () => void;
  resetAvatar: () => void;
  completeOnboarding: (intent: string) => void;
  setCalendarDate: (date: string) => void;
  listModels: (draft: { providerId: string; endpoint: string; apiKey: string }) => Promise<string[]>;
  saveModel: (draft: { providerId: string; endpoint: string; apiKey: string; model: string }) => boolean;
  setCloudConsent: (allowed: boolean) => void;
  exportBackup: () => void;
  importBackup: () => void;
  clearSources: () => void;
  setUrgentOverride: (enabled: boolean) => void;
  loadEarlierMessages: (beforeId: string, limit?: number) => Promise<RuntimeSnapshot["preferences"]["messages"]>;
}

declare global {
  interface Window { __XUECHENG_REACT_RUNTIME__?: LegacyRuntimePort; }
}

export function runtimeFromWindow(target: Window | null | undefined = window): LegacyRuntimePort | null {
  try { return target?.__XUECHENG_REACT_RUNTIME__ || null; }
  catch { return null; }
}
