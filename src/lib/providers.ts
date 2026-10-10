import type { ProviderConfig } from "../types";

/**
 * ANVIL is provider-agnostic. Every provider below speaks one of two wire
 * formats — the OpenAI Chat Completions format (OpenAI + xAI Grok are
 * compatible) or the Anthropic Messages format. Adding a new provider is a
 * matter of appending an entry here.
 *
 * Model lists are suggestions; the UI also accepts a free-text model id, so
 * new models work without a code change.
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-...",
    envVar: "OPENAI_API_KEY",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "o4-mini", label: "o4-mini (reasoning)" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-...",
    envVar: "ANTHROPIC_API_KEY",
    docsUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    ],
  },
  {
    id: "xai",
    label: "xAI Grok",
    kind: "openai",
    baseUrl: "https://api.x.ai/v1",
    keyLabel: "xAI API key",
    keyPlaceholder: "xai-...",
    envVar: "XAI_API_KEY",
    docsUrl: "https://console.x.ai",
    defaultModel: "grok-3-mini",
    models: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3", label: "Grok 3" },
      { id: "grok-3-mini", label: "Grok 3 mini" },
      { id: "grok-code-fast-1", label: "Grok Code Fast 1" },
    ],
  },
];

export function getProvider(id: string): ProviderConfig {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/**
 * Guess the provider from the shape of an API key, so pasting a key selects
 * the right provider automatically. Returns null when the format is unknown.
 */
export function detectProviderFromKey(key: string): string | null {
  const k = key.trim();
  if (!k) return null;
  // Order matters: "sk-ant-" also starts with "sk-".
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("xai-")) return "xai";
  if (k.startsWith("sk-proj-") || k.startsWith("sk-")) return "openai";
  return null;
}
