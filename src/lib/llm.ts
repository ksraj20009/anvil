import type { ChatMessage, ProviderConfig, ToolCall, ToolDef } from "../types";

/**
 * Provider-agnostic chat client.
 *
 * Two wire formats are supported:
 *   - "openai"    → OpenAI Chat Completions (OpenAI, xAI Grok, and anything
 *                   OpenAI-compatible).
 *   - "anthropic" → Anthropic Messages API.
 *
 * Requests either go direct (BYOK: the user's key from the browser) or through
 * ANVIL's serverless proxy at /api/chat, which injects a server-side key.
 */
export interface ChatRequest {
  provider: ProviderConfig;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  mode: "byok" | "proxy";
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

function requestUrl(req: ChatRequest): string {
  if (req.mode === "proxy") return "/api/chat";
  const p = req.provider;
  return p.kind === "openai"
    ? `${p.baseUrl}/chat/completions`
    : `${p.baseUrl}/messages`;
}

function headers(req: ChatRequest): Record<string, string> {
  const p = req.provider;
  if (req.mode === "proxy") {
    return {
      "content-type": "application/json",
      "x-anvil-provider": p.id,
      "x-anvil-model": req.model,
    };
  }
  if (p.kind === "openai") {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${req.apiKey ?? ""}`,
    };
  }
  return {
    "content-type": "application/json",
    "x-api-key": req.apiKey ?? "",
    "anthropic-version": "2023-06-01",
    // Required for calling the Anthropic API from a browser context.
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function toOpenAIMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
}

export function toAnthropicMessages(messages: ChatMessage[]): {
  system: string;
  messages: unknown[];
} {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const out: { role: string; content: unknown }[] = [];
  const pushToolResult = (block: AnthropicBlock) => {
    const last = out[out.length - 1];
    if (last && last.role === "user" && Array.isArray(last.content)) {
      (last.content as AnthropicBlock[]).push(block);
    } else {
      out.push({ role: "user", content: [block] });
    }
  };

  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: AnthropicBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: safeParse(tc.arguments) });
      }
      out.push({ role: "assistant", content: blocks });
    } else if (m.role === "tool") {
      pushToolResult({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return { system, messages: out };
}

function buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
  const p = req.provider;
  if (p.kind === "openai") {
    const model = req.model;
    // o-series reasoning models reject temperature/max_tokens and want
    // max_completion_tokens instead.
    const isReasoning = /^o[0-9]/.test(model);
    const body: Record<string, unknown> = {
      model,
      messages: toOpenAIMessages(req.messages),
      stream,
    };
    if (stream) body.stream_options = { include_usage: true };
    if (isReasoning) {
      body.max_completion_tokens = req.maxTokens ?? 4096;
    } else {
      body.max_tokens = req.maxTokens ?? 4096;
      if (req.temperature != null) body.temperature = req.temperature;
    }
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = "auto";
    }
    return body;
  }

  const { system, messages } = toAnthropicMessages(req.messages);
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    messages,
    stream,
  };
  if (system) body.system = system;
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }
  return body;
}

async function errorText(res: Response): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    /* ignore */
  }
  try {
    const j = JSON.parse(raw);
    const msg = j?.error?.message ?? j?.message ?? j?.error;
    if (msg) return `${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`;
  } catch {
    /* not json */
  }
  return `${res.status} ${res.statusText}${raw ? ` — ${raw.slice(0, 300)}` : ""}`;
}

function extractDelta(req: ChatRequest, payload: string): string {
  let j: any;
  try {
    j = JSON.parse(payload);
  } catch {
    return "";
  }
  if (req.provider.kind === "openai") {
    const d = j?.choices?.[0]?.delta;
    return typeof d?.content === "string" ? d.content : "";
  }
  if (j?.type === "content_block_delta" && j?.delta?.type === "text_delta") {
    return typeof j.delta.text === "string" ? j.delta.text : "";
  }
  return "";
}

/** Stream assistant text, yielding incremental chunks. */
export async function* streamText(req: ChatRequest): AsyncGenerator<string> {
  const res = await fetch(requestUrl(req), {
    method: "POST",
    headers: headers(req),
    body: JSON.stringify(buildBody(req, true)),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  if (!res.body) throw new Error("Response had no body to stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const chunk = extractDelta(req, payload);
      if (chunk) yield chunk;
    }
  }
}

/** One non-streaming turn, returning text and any tool calls. */
export async function complete(
  req: ChatRequest
): Promise<{ text: string; toolCalls: ToolCall[] }> {
  const res = await fetch(requestUrl(req), {
    method: "POST",
    headers: headers(req),
    body: JSON.stringify(buildBody(req, false)),
    signal: req.signal,
  });
  if (!res.ok) throw new Error(await errorText(res));
  const j: any = await res.json();

  if (req.provider.kind === "openai") {
    const msg = j?.choices?.[0]?.message ?? {};
    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name ?? "",
      arguments: tc.function?.arguments ?? "{}",
    }));
    return { text: typeof msg.content === "string" ? msg.content : "", toolCalls };
  }

  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const block of j?.content ?? []) {
    if (block.type === "text") text += block.text ?? "";
    else if (block.type === "tool_use")
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input ?? {}),
      });
  }
  return { text, toolCalls };
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

export interface ListModelsOptions {
  provider: ProviderConfig;
  mode: "byok" | "proxy";
  apiKey?: string;
  signal?: AbortSignal;
}

/**
 * Ask the provider which models this key can use. Works against the live
 * `/models` endpoint (direct with BYOK, or through the hosted proxy).
 */
export async function listModels(opts: ListModelsOptions): Promise<string[]> {
  const { provider: p, mode, apiKey, signal } = opts;
  let res: Response;

  if (mode === "proxy") {
    res = await fetch("/api/chat", {
      method: "GET",
      headers: { "x-anvil-provider": p.id, "x-anvil-models": "1" },
      signal,
    });
  } else {
    const headers: Record<string, string> = {};
    if (p.kind === "openai") {
      headers.authorization = `Bearer ${apiKey ?? ""}`;
    } else {
      headers["x-api-key"] = apiKey ?? "";
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    res = await fetch(`${p.baseUrl}/models`, { method: "GET", headers, signal });
  }

  if (!res.ok) throw new Error(await errorText(res));
  return filterChatModels(parseModelList(await res.json()));
}

/** Pull model ids out of the various shapes a /models endpoint may return. */
export function parseModelList(json: unknown): string[] {
  const j = json as any;
  const arr: any[] = Array.isArray(j?.data)
    ? j.data
    : Array.isArray(j?.models)
      ? j.models
      : Array.isArray(j)
        ? j
        : [];
  const ids = arr
    .map((m) => (typeof m === "string" ? m : m?.id ?? m?.name))
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  return [...new Set(ids)];
}

/** Substrings that mark a model as non-conversational. */
const NON_CHAT = [
  "embedding",
  "moderation",
  "whisper",
  "tts",
  "dall-e",
  "dall\u00b7e",
  "audio",
  "speech",
  "transcribe",
  "realtime",
  "sora",
  "image-",
  "-image",
  "davinci",
  "babbage",
  "ada-",
  "curie",
];

/** Keep conversational models, sorted for a clean dropdown. */
export function filterChatModels(ids: string[]): string[] {
  return ids
    .filter((id) => !NON_CHAT.some((t) => id.toLowerCase().includes(t)))
    .sort((a, b) => a.localeCompare(b));
}
