import type { SupabaseClient } from "@supabase/supabase-js";
import type { VFile } from "./vfs";
import type { Session } from "./sessions";

/**
 * ANVIL cloud sync (Supabase).
 *
 * Optional and entirely opt-in: the app works fully offline with localStorage.
 * When a Supabase URL + anon key are configured, a user can sign in (anonymously
 * or by email) and keep their workspace in the cloud, or publish a read-only
 * share link.
 *
 * The pure helpers below are exported for unit testing.
 */

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export interface CloudWorkspace {
  id: string;
  name: string;
  files: VFile[];
  sessions: Session[];
  updated_at: string;
}

export function makeSlug(prefix = "anvil"): string {
  const rand = () => Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand()}${rand()}`;
}

export function buildWorkspacePayload(name: string, files: VFile[], sessions: Session[]) {
  return { name: name?.trim() || "My workspace", files, sessions };
}

export function normalizeWorkspaceRow(row: unknown): CloudWorkspace {
  const r = row as Record<string, unknown>;
  const files = Array.isArray(r?.files)
    ? (r.files as Array<{ path?: unknown; content?: unknown }>)
        .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
        .map((f) => ({ path: f.path as string, content: f.content as string }))
    : [];
  return {
    id: typeof r?.id === "string" ? r.id : "",
    name: typeof r?.name === "string" ? r.name : "Workspace",
    files,
    sessions: Array.isArray(r?.sessions) ? (r.sessions as Session[]) : [],
    updated_at: typeof r?.updated_at === "string" ? r.updated_at : "",
  };
}

let client: SupabaseClient | null = null;
let clientKey = "";

export async function getClient(cfg: CloudConfig): Promise<SupabaseClient> {
  const key = `${cfg.url}|${cfg.anonKey}`;
  if (client && clientKey === key) return client;
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  clientKey = key;
  return client;
}

export interface CloudUser {
  id: string;
  isAnonymous: boolean;
  email?: string;
}

export async function currentUser(cfg: CloudConfig): Promise<CloudUser | null> {
  const sb = await getClient(cfg);
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const u = data.user as { id: string; is_anonymous?: boolean; email?: string };
  return { id: u.id, isAnonymous: Boolean(u.is_anonymous), email: u.email };
}

export async function signInAnonymously(cfg: CloudConfig): Promise<CloudUser> {
  const sb = await getClient(cfg);
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Anonymous sign-in returned no user.");
  return { id: data.user.id, isAnonymous: true };
}

export async function signInWithEmail(cfg: CloudConfig, email: string): Promise<void> {
  const sb = await getClient(cfg);
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(cfg: CloudConfig): Promise<void> {
  const sb = await getClient(cfg);
  await sb.auth.signOut();
}

export async function listWorkspaces(cfg: CloudConfig): Promise<CloudWorkspace[]> {
  const sb = await getClient(cfg);
  const { data, error } = await sb
    .from("workspaces")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeWorkspaceRow);
}

export async function saveWorkspace(
  cfg: CloudConfig,
  input: { id?: string; name: string; files: VFile[]; sessions: Session[] }
): Promise<CloudWorkspace> {
  const sb = await getClient(cfg);
  const user = await currentUser(cfg);
  if (!user) throw new Error("Not signed in.");
  const payload = { ...buildWorkspacePayload(input.name, input.files, input.sessions), user_id: user.id };
  const query = input.id
    ? sb.from("workspaces").update(payload).eq("id", input.id)
    : sb.from("workspaces").insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(error.message);
  return normalizeWorkspaceRow(data);
}

export async function deleteWorkspace(cfg: CloudConfig, id: string): Promise<void> {
  const sb = await getClient(cfg);
  const { error } = await sb.from("workspaces").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function shareProject(
  cfg: CloudConfig,
  files: VFile[],
  title: string
): Promise<string> {
  const sb = await getClient(cfg);
  const user = await currentUser(cfg);
  const slug = makeSlug();
  const { error } = await sb
    .from("shared_projects")
    .insert({ slug, title: title || "Shared project", files, created_by: user?.id ?? null });
  if (error) throw new Error(error.message);
  return slug;
}

export async function getShared(cfg: CloudConfig, slug: string): Promise<CloudWorkspace | null> {
  const sb = await getClient(cfg);
  const { data, error } = await sb.from("shared_projects").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeWorkspaceRow(data) : null;
}

export function shareUrl(slug: string): string {
  const u = new URL(window.location.href);
  u.search = `?p=${encodeURIComponent(slug)}`;
  u.hash = "";
  return u.toString();
}
