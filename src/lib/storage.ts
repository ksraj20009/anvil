import type { Settings } from "../types";
import { PROVIDERS } from "./providers";
import { parseChat, serializeChat, type ChatState } from "./project";
import { parseSessions, serializeSessions, type SessionsState } from "./sessions";

const SETTINGS_KEY = "anvil.settings.v1";
const CHAT_KEY = "anvil.chat.v1";
const SESSIONS_KEY = "anvil.sessions.v1";

export const DEFAULT_SETTINGS: Settings = {
  providerId: "openai",
  model: PROVIDERS[0].defaultModel,
  mode: "byok",
  apiKeys: {},
  autoApply: false,
  temperature: 0.2,
  theme: "dark",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, apiKeys: { ...(parsed.apiKeys ?? {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — non-fatal */
  }
}

export function loadChat(): ChatState | null {
  try {
    return parseChat(localStorage.getItem(CHAT_KEY));
  } catch {
    return null;
  }
}

export function saveChat(state: ChatState): void {
  try {
    localStorage.setItem(CHAT_KEY, serializeChat(state));
  } catch {
    /* ignore */
  }
}

export function clearChat(): void {
  try {
    localStorage.removeItem(CHAT_KEY);
  } catch {
    /* ignore */
  }
}

export function loadSessions(): SessionsState | null {
  try {
    return parseSessions(localStorage.getItem(SESSIONS_KEY));
  } catch {
    return null;
  }
}

export function saveSessions(state: SessionsState): void {
  try {
    localStorage.setItem(SESSIONS_KEY, serializeSessions(state));
  } catch {
    /* ignore */
  }
}
