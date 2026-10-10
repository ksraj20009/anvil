// ANVIL — shared types

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string of arguments, exactly as the model emitted it. */
  arguments: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  /** Assistant messages may carry tool calls. */
  toolCalls?: ToolCall[];
  /** Tool result messages reference the call they answer. */
  toolCallId?: string;
  name?: string;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export type ProviderKind = "openai" | "anthropic";

export interface ProviderConfig {
  id: string;
  label: string;
  /** Wire format family. OpenAI-compatible vs Anthropic Messages API. */
  kind: ProviderKind;
  baseUrl: string;
  keyLabel: string;
  keyPlaceholder: string;
  envVar: string;
  docsUrl: string;
  defaultModel: string;
  models: { id: string; label: string }[];
}

export type RequestMode = "byok" | "proxy";

export interface Settings {
  providerId: string;
  model: string;
  mode: RequestMode;
  /** Per-provider API keys, kept only in this browser's localStorage. */
  apiKeys: Record<string, string>;
  autoApply: boolean;
  temperature: number;
}

export interface PendingChange {
  id: string;
  path: string;
  before: string;
  after: string;
  /** Resolves the agent's await: true = apply, false = reject. */
  resolve: (apply: boolean) => void;
}

export interface LogLine {
  level: "log" | "info" | "warn" | "error" | "system";
  text: string;
}
