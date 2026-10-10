import type { Settings } from "../types";
import { PROVIDERS } from "./providers";

const SETTINGS_KEY = "anvil.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  providerId: "openai",
  model: PROVIDERS[0].defaultModel,
  mode: "byok",
  apiKeys: {},
  autoApply: false,
  temperature: 0.2,
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
