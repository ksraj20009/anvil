import type { ProviderConfig } from "../types";

/**
 * ANVIL is provider-agnostic. Every provider below speaks one of two wire
 * formats — the OpenAI Chat Completions format (the vast majority) or the
 * Anthropic Messages format. Adding a provider is one entry here.
 *
 * Model lists are suggestions; the UI also fetches the live model list from the
 * provider, and accepts a free-text model id, so new models work immediately.
 *
 * Sarvam is first because it is ANVIL's default (see DEFAULT_SETTINGS).
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: "sarvam",
    label: "Sarvam AI",
    kind: "openai",
    baseUrl: "https://api.sarvam.ai/v2",
    keyLabel: "Sarvam API key",
    keyPlaceholder: "your sarvam api-subscription-key",
    envVar: "SARVAM_API_KEY",
    docsUrl: "https://dashboard.sarvam.ai",
    defaultModel: "sarvam-105b",
    color: "#f97316",
    requiresKey: true,
    models: [
      { id: "sarvam-105b", label: "Sarvam-105B (flagship)" },
      { id: "sarvam-105b-conversations", label: "Sarvam-105B Conversations" },
      { id: "glm5.3", label: "GLM 5.3" },
      { id: "gemma4", label: "Gemma 4" },
      { id: "deepseekv4.1-flash", label: "DeepSeek V4.1 Flash" },
    ],
  },
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
    color: "#10a37f",
    requiresKey: true,
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
    color: "#d97757",
    requiresKey: true,
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
    color: "#9aa0a6",
    requiresKey: true,
    models: [
      { id: "grok-4", label: "Grok 4" },
      { id: "grok-3", label: "Grok 3" },
      { id: "grok-3-mini", label: "Grok 3 mini" },
      { id: "grok-code-fast-1", label: "Grok Code Fast 1" },
    ],
  },
  {
    id: "google",
    label: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza...",
    envVar: "GEMINI_API_KEY",
    docsUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash",
    color: "#4285f4",
    requiresKey: true,
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    kind: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyLabel: "NVIDIA API key",
    keyPlaceholder: "nvapi-...",
    envVar: "NVIDIA_API_KEY",
    docsUrl: "https://build.nvidia.com/settings",
    defaultModel: "meta/llama-3.1-8b-instruct",
    color: "#76b900",
    requiresKey: true,
    models: [
      { id: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct" },
      { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "qwen/qwen2.5-coder-32b-instruct", label: "Qwen2.5 Coder 32B" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    keyLabel: "Mistral API key",
    keyPlaceholder: "...",
    envVar: "MISTRAL_API_KEY",
    docsUrl: "https://console.mistral.ai/api-keys",
    defaultModel: "mistral-large-latest",
    color: "#ff7000",
    requiresKey: true,
    models: [
      { id: "mistral-large-latest", label: "Mistral Large" },
      { id: "mistral-small-latest", label: "Mistral Small" },
      { id: "codestral-latest", label: "Codestral" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    keyLabel: "DeepSeek API key",
    keyPlaceholder: "sk-...",
    envVar: "DEEPSEEK_API_KEY",
    docsUrl: "https://platform.deepseek.com/api_keys",
    defaultModel: "deepseek-chat",
    color: "#4d6bfe",
    requiresKey: true,
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyLabel: "Groq API key",
    keyPlaceholder: "gsk_...",
    envVar: "GROQ_API_KEY",
    docsUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    color: "#f55036",
    requiresKey: true,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B" },
      { id: "qwen-2.5-coder-32b", label: "Qwen2.5 Coder 32B" },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    kind: "openai",
    baseUrl: "https://api.together.xyz/v1",
    keyLabel: "Together API key",
    keyPlaceholder: "...",
    envVar: "TOGETHER_API_KEY",
    docsUrl: "https://api.together.ai/settings/api-keys",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    color: "#0f6fff",
    requiresKey: true,
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen2.5 Coder 32B" },
      { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek R1" },
    ],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    kind: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyLabel: "Fireworks API key",
    keyPlaceholder: "fw_...",
    envVar: "FIREWORKS_API_KEY",
    docsUrl: "https://fireworks.ai/account/api-keys",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    color: "#ff5c39",
    requiresKey: true,
    models: [
      { id: "accounts/fireworks/models/llama-v3p3-70b-instruct", label: "Llama 3.3 70B" },
      { id: "accounts/fireworks/models/qwen2p5-coder-32b-instruct", label: "Qwen2.5 Coder 32B" },
      { id: "accounts/fireworks/models/deepseek-r1", label: "DeepSeek R1" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyLabel: "OpenRouter API key",
    keyPlaceholder: "sk-or-...",
    envVar: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/keys",
    defaultModel: "openai/gpt-4o-mini",
    color: "#8b5cf6",
    requiresKey: true,
    models: [
      { id: "openai/gpt-4o-mini", label: "OpenAI GPT-4o mini" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    ],
  },
  {
    id: "perplexity",
    label: "Perplexity",
    kind: "openai",
    baseUrl: "https://api.perplexity.ai",
    keyLabel: "Perplexity API key",
    keyPlaceholder: "pplx-...",
    envVar: "PERPLEXITY_API_KEY",
    docsUrl: "https://www.perplexity.ai/settings/api",
    defaultModel: "sonar",
    color: "#20808d",
    requiresKey: true,
    models: [
      { id: "sonar", label: "Sonar" },
      { id: "sonar-pro", label: "Sonar Pro" },
      { id: "sonar-reasoning", label: "Sonar Reasoning" },
    ],
  },
  {
    id: "cohere",
    label: "Cohere",
    kind: "openai",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    keyLabel: "Cohere API key",
    keyPlaceholder: "...",
    envVar: "COHERE_API_KEY",
    docsUrl: "https://dashboard.cohere.com/api-keys",
    defaultModel: "command-r-plus",
    color: "#39594d",
    requiresKey: true,
    models: [
      { id: "command-r-plus", label: "Command R+" },
      { id: "command-r", label: "Command R" },
    ],
  },
  {
    id: "cerebras",
    label: "Cerebras",
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    keyLabel: "Cerebras API key",
    keyPlaceholder: "csk-...",
    envVar: "CEREBRAS_API_KEY",
    docsUrl: "https://cloud.cerebras.ai",
    defaultModel: "llama-3.3-70b",
    color: "#f2a900",
    requiresKey: true,
    models: [
      { id: "llama-3.3-70b", label: "Llama 3.3 70B" },
      { id: "llama3.1-8b", label: "Llama 3.1 8B" },
      { id: "qwen-2.5-coder-32b", label: "Qwen2.5 Coder 32B" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyLabel: "API key",
    keyPlaceholder: "not required",
    envVar: "",
    docsUrl: "https://ollama.com",
    defaultModel: "llama3.2",
    color: "#c7c7c7",
    requiresKey: false,
    models: [
      { id: "llama3.2", label: "Llama 3.2" },
      { id: "qwen2.5-coder", label: "Qwen2.5 Coder" },
      { id: "deepseek-r1", label: "DeepSeek R1" },
      { id: "mistral", label: "Mistral" },
    ],
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    kind: "openai",
    baseUrl: "http://localhost:1234/v1",
    keyLabel: "API key",
    keyPlaceholder: "not required",
    envVar: "",
    docsUrl: "https://lmstudio.ai",
    defaultModel: "local-model",
    color: "#a78bfa",
    requiresKey: false,
    models: [{ id: "local-model", label: "Loaded local model" }],
  },
];

export function getProvider(id: string): ProviderConfig {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/**
 * The provider actually used for a request: the selected provider, with its
 * base URL replaced when the user set an override (Ollama, LM Studio,
 * OpenRouter, a proxy, …).
 */
export function effectiveProvider(settings: {
  providerId: string;
  baseUrlOverride?: string;
}): ProviderConfig {
  const base = getProvider(settings.providerId);
  const override = settings.baseUrlOverride?.trim();
  if (!override) return base;
  return { ...base, baseUrl: override.replace(/\/+$/, "") };
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
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("nvapi-")) return "nvidia";
  if (k.startsWith("pplx-")) return "perplexity";
  if (k.startsWith("fw_")) return "fireworks";
  if (k.startsWith("csk-")) return "cerebras";
  if (k.startsWith("AIza")) return "google";
  if (k.startsWith("sk-proj-") || k.startsWith("sk-")) return "openai";
  return null;
}
