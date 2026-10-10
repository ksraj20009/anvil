import type { ChatMessage, TranscriptItem } from "../types";
import type { VFile } from "./vfs";

/**
 * Pure (de)serialization for project files and chat state. Kept free of any
 * browser APIs so it can be unit-tested and reused anywhere.
 */

export const PROJECT_FORMAT = "anvil-project";
export const PROJECT_VERSION = 1;

export interface ProjectFile {
  app: string;
  version: number;
  files: VFile[];
}

export function serializeProject(files: VFile[]): string {
  const payload: ProjectFile = { app: PROJECT_FORMAT, version: PROJECT_VERSION, files };
  return JSON.stringify(payload, null, 2);
}

/** Parse an exported project. Throws a friendly error when the shape is wrong. */
export function parseProject(text: string): VFile[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const files = (json as { files?: unknown })?.files;
  if (!Array.isArray(files)) throw new Error("No `files` array found in the project.");
  const out: VFile[] = [];
  for (const f of files as Array<{ path?: unknown; content?: unknown }>) {
    if (typeof f?.path === "string" && typeof f?.content === "string") {
      out.push({ path: f.path, content: f.content });
    }
  }
  if (out.length === 0) throw new Error("The project contained no valid files.");
  return out;
}

export interface ChatState {
  history: ChatMessage[];
  items: TranscriptItem[];
}

export function serializeChat(state: ChatState): string {
  return JSON.stringify(state);
}

/** Parse persisted chat state, returning null when absent or malformed. */
export function parseChat(text: string | null): ChatState | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const obj = json as { history?: unknown; items?: unknown };
  if (!Array.isArray(obj.history) || !Array.isArray(obj.items)) return null;
  const history = (obj.history as ChatMessage[]).filter(
    (m) => m && typeof m.role === "string" && typeof m.content === "string"
  );
  const items = (obj.items as TranscriptItem[]).filter(
    (i) => i && typeof (i as { kind?: unknown }).kind === "string"
  );
  return { history, items };
}
