import type { ChatMessage, TranscriptItem } from "../types";

/** A single conversation. Several can coexist and be switched from the sidebar. */
export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  history: ChatMessage[];
  items: TranscriptItem[];
}

export interface SessionsState {
  activeId: string;
  sessions: Session[];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newSession(systemPrompt: string, id: string = uid()): Session {
  const now = Date.now();
  return {
    id,
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    history: [{ role: "system", content: systemPrompt }],
    items: [],
  };
}

/** Derive a short title from the first user message. */
export function titleFor(items: TranscriptItem[]): string {
  const first = items.find((i) => i.kind === "user") as { kind: "user"; text: string } | undefined;
  if (!first) return "New chat";
  const t = first.text.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

export function serializeSessions(state: SessionsState): string {
  return JSON.stringify(state);
}

/** Parse persisted sessions, returning null when absent or unusable. */
export function parseSessions(text: string | null): SessionsState | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const j = json as { activeId?: unknown; sessions?: unknown };
  if (!Array.isArray(j.sessions) || j.sessions.length === 0) return null;
  const sessions: Session[] = (j.sessions as Session[])
    .filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        Array.isArray(s.history) &&
        Array.isArray(s.items)
    )
    .map((s) => ({
      id: s.id,
      title: typeof s.title === "string" ? s.title : "New chat",
      createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now(),
      updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : Date.now(),
      history: s.history,
      items: s.items,
    }));
  if (sessions.length === 0) return null;
  const activeId =
    typeof j.activeId === "string" && sessions.some((s) => s.id === j.activeId)
      ? j.activeId
      : sessions[0].id;
  return { activeId, sessions };
}
