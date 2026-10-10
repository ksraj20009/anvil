/**
 * ANVIL Virtual File System (VFS).
 *
 * A browser-native project tree: a flat map of path -> text content, persisted
 * to localStorage. The agent's tools operate on this, and the editor renders
 * it. It is deliberately simple and dependency-free.
 */

const VFS_KEY = "anvil.vfs.v1";

export interface VFile {
  path: string;
  content: string;
}

const SEED: VFile[] = [
  {
    path: "README.md",
    content:
      "# Welcome to ANVIL\n\nThis is a live virtual workspace. Ask the agent to build something —\nit will read and write these files (with your approval).\n\nTry:\n\n- \"Create a todo app in a single HTML file\"\n- \"Add a function that reverses a string, with tests\"\n- \"Refactor app.js to use async/await\"\n",
  },
  {
    path: "index.html",
    content:
      '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Sandbox</title>\n  </head>\n  <body>\n    <h1>Hello from ANVIL</h1>\n    <script src="app.js"></script>\n  </body>\n</html>\n',
  },
  {
    path: "app.js",
    content:
      '// A tiny starting point. Ask ANVIL to change it.\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("world"));\n',
  },
];

type Listener = () => void;

class VFS {
  private files = new Map<string, string>();
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(VFS_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as VFile[];
        for (const f of arr) this.files.set(f.path, f.content);
      } else {
        for (const f of SEED) this.files.set(f.path, f.content);
        this.persist();
      }
    } catch {
      for (const f of SEED) this.files.set(f.path, f.content);
    }
  }

  private persist() {
    try {
      const arr: VFile[] = [...this.files.entries()].map(([path, content]) => ({ path, content }));
      localStorage.setItem(VFS_KEY, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  }

  private emit() {
    this.persist();
    for (const l of this.listeners) l();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  list(): string[] {
    return [...this.files.keys()].sort();
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  read(path: string): string | undefined {
    return this.files.get(path);
  }

  write(path: string, content: string): void {
    this.files.set(path, content);
    this.emit();
  }

  create(path: string, content = ""): void {
    if (!this.files.has(path)) {
      this.files.set(path, content);
      this.emit();
    }
  }

  delete(path: string): void {
    if (this.files.delete(path)) this.emit();
  }

  rename(from: string, to: string): void {
    if (!this.files.has(from) || this.files.has(to)) return;
    const c = this.files.get(from)!;
    this.files.delete(from);
    this.files.set(to, c);
    this.emit();
  }

  /** Replace the entire tree (used by "import project"). */
  replaceAll(files: VFile[]): void {
    this.files.clear();
    for (const f of files) this.files.set(f.path, f.content);
    this.emit();
  }

  /** Restore the starter project. */
  reset(): void {
    this.files.clear();
    for (const f of SEED) this.files.set(f.path, f.content);
    this.emit();
  }

  snapshot(): VFile[] {
    return [...this.files.entries()].map(([path, content]) => ({ path, content }));
  }
}

export const vfs = new VFS();
