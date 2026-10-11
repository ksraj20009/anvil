/**
 * Minimal GitHub client for the browser (bring-your-own personal access token).
 *
 * Supports: verifying a token, listing the user's repos, pulling a repo's text
 * files into the workspace, and pushing the workspace back as one commit.
 * Pure helpers are exported separately so they can be unit-tested.
 */
import type { VFile } from "./vfs";

const API = "https://api.github.com";
const MAX_FILES = 150;

export interface RepoRef {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  updatedAt: string;
}

export interface TreeEntry {
  path: string;
  type: string;
  sha?: string;
}

export interface Viewer {
  login: string;
  name: string | null;
}

const BINARY_EXT = [
  "png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif", "tiff", "psd", "sketch",
  "pdf", "zip", "gz", "tar", "tgz", "rar", "7z",
  "mp4", "mov", "avi", "mkv", "mp3", "wav", "ogg", "flac",
  "woff", "woff2", "ttf", "otf", "eot",
  "so", "dll", "exe", "bin", "class", "jar", "wasm", "o", "a",
];

const SKIP_DIRS = ["node_modules/", ".git/", "dist/", "build/", ".next/", "vendor/", ".venv/"];

/** Whether a repo path is worth pulling as text. */
export function isTextPath(path: string): boolean {
  if (SKIP_DIRS.some((d) => path.startsWith(d) || path.includes(`/${d}`))) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return true; // extensionless files (LICENSE, Makefile) are usually text
  return !BINARY_EXT.includes(ext);
}

/** Choose the blobs to download from a git tree. */
export function selectRepoFiles(tree: TreeEntry[], limit = MAX_FILES): string[] {
  return tree
    .filter((e) => e.type === "blob" && isTextPath(e.path))
    .map((e) => e.path)
    .slice(0, limit);
}

/** Parse the /user/repos response into the shape the UI uses. */
export function parseRepos(json: unknown): RepoRef[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((r) => r && typeof r.full_name === "string")
    .map((r) => ({
      fullName: r.full_name as string,
      defaultBranch: typeof r.default_branch === "string" ? r.default_branch : "main",
      isPrivate: Boolean(r.private),
      description: typeof r.description === "string" ? r.description : null,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : "",
    }));
}

/** Decode GitHub's base64 file content, including UTF-8. */
export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function gh(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.message) message = `${res.status}: ${j.message}`;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getViewer(token: string): Promise<Viewer> {
  const j = (await gh(token, "/user")) as { login: string; name?: string | null };
  return { login: j.login, name: j.name ?? null };
}

export async function listRepos(token: string): Promise<RepoRef[]> {
  return parseRepos(await gh(token, "/user/repos?per_page=100&sort=updated"));
}

/** Pull a repository's text files into VFile[] for the workspace. */
export async function pullRepo(
  token: string,
  fullName: string,
  ref: string,
  onProgress?: (done: number, total: number) => void
): Promise<VFile[]> {
  const [owner, repo] = fullName.split("/");
  const tree = (await gh(token, `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`)) as {
    tree?: TreeEntry[];
  };
  const paths = selectRepoFiles(tree.tree ?? []);

  const files: VFile[] = [];
  let done = 0;
  for (const path of paths) {
    try {
      const content = (await gh(token, `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`)) as {
        content?: string;
        encoding?: string;
      };
      if (content.content) {
        files.push({
          path,
          content: content.encoding === "base64" ? decodeBase64(content.content) : content.content,
        });
      }
    } catch {
      /* skip files that fail (e.g. submodules) */
    }
    done += 1;
    onProgress?.(done, paths.length);
  }
  return files;
}

/** Commit the given files to a branch in one commit. */
export async function pushFiles(
  token: string,
  fullName: string,
  branch: string,
  files: VFile[],
  message: string
): Promise<{ sha: string; url: string }> {
  const [owner, repo] = fullName.split("/");
  const ref = (await gh(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)) as {
    object: { sha: string };
  };
  const baseSha = ref.object.sha;
  const baseCommit = (await gh(token, `/repos/${owner}/${repo}/git/commits/${baseSha}`)) as {
    tree: { sha: string };
  };

  const tree = [];
  for (const f of files) {
    const blob = (await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
    })) as { sha: string };
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = (await gh(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  })) as { sha: string };

  const commit = (await gh(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
  })) as { sha: string };

  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { sha: commit.sha, url: `https://github.com/${fullName}/commit/${commit.sha}` };
}
