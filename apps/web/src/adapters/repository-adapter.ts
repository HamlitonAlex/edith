import { clientMessageId, profilePatchFromLocal } from "../../lib/app-repository.js";

export interface LocalPreferences {
  name?: string;
  role?: string;
  gender?: string;
  initiative?: number;
  directness?: number;
  theme?: "day" | "night";
  cloudConsent?: boolean;
  quietStart?: string;
  quietEnd?: string;
  urgentOverride?: boolean;
}

export interface LocalMessage {
  clientMessageId?: string;
  createdAt?: string;
  id?: string;
  role?: "assistant" | "user";
  text?: string;
}

export interface RepositoryPort {
  readRemote?: (input: unknown) => Promise<unknown>;
  snapshot?: () => unknown;
  syncAll?: (input: unknown) => Promise<unknown>;
}

/**
 * Boundary for the React UI migration. It deliberately calls the existing
 * repository rather than duplicating authentication, storage, or sync rules.
 */
export function createRepositoryAdapter(repository: RepositoryPort) {
  return {
    snapshot: () => repository.snapshot?.() ?? { syncStatus: "local" },
    readRemote: (input: unknown) => repository.readRemote?.(input),
    syncAll: (input: unknown) => repository.syncAll?.(input),
  };
}

export function toProfilePatch(preferences: LocalPreferences) {
  return profilePatchFromLocal(preferences);
}

export function toConversationMessage(message: LocalMessage, index: number) {
  return {
    ...message,
    clientMessageId: clientMessageId(message, index),
    createdAt: message.createdAt ?? new Date(0).toISOString(),
    text: String(message.text ?? ""),
  };
}
