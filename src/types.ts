// ANVIL — shared types

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string of arguments, exactly as the model emitted it. */
  arguments: string;
}

export interface ChatImage {
  mime: string;
  /** base64 payload without the data-URL prefix. */
  data: string;
  /** full data URL. */
  dataUrl: string;
}

export interface ChatMessage {
  role: Role;
  content: string;
  /** Assistant messages may carry tool calls. */
  toolCalls?: ToolCall[];
  /** Tool result messages reference the call they answer. */
  toolCallId?: string;
  name?: string;
  /** Images attached to a user message (vision models). */
  images?: ChatImage[];
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
  /** Accent colour for the provider mark in the UI. */
  color: string;
  /** Whether an API key is required (false for local endpoints). */
  requiresKey: boolean;
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
  theme: "dark" | "light";
  /** Optional GitHub personal access token for repo sync. */
  githubToken: string;
  /** Optional base-URL override for any OpenAI-compatible endpoint. */
  baseUrlOverride: string;
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

/** One row in the chat transcript. */
export type TranscriptItem =
  | { kind: "user"; text: string; images?: string[] }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; args: string; result?: string }
  | { kind: "error"; text: string };
