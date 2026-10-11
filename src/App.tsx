import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatImage, ChatMessage, LogLine, PendingChange, Settings } from "./types";
import { vfs, type VFile } from "./lib/vfs";
import { loadSettings, saveSettings, loadSessions, saveSessions } from "./lib/storage";
import { serializeProject, parseProject } from "./lib/project";
import { effectiveProvider } from "./lib/providers";
import { streamText } from "./lib/llm";
import { runAgentTurn } from "./lib/agent";
import { runCode, languageOf } from "./lib/exec";
import { expandMentions } from "./lib/mentions";
import { newSession, titleFor, type SessionsState } from "./lib/sessions";
import { FileExplorer } from "./components/FileExplorer";
import { EditorPanel } from "./components/EditorPanel";
import { ChatPanel, type Item } from "./components/ChatPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { SettingsModal } from "./components/SettingsModal";
import { DiffReview } from "./components/DiffReview";
import { SessionList } from "./components/SessionList";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { GitHubPanel } from "./components/GitHubPanel";
import { readImageFile, MAX_IMAGES, type AttachedImage } from "./lib/vision";

const SYSTEM_PROMPT = `You are ANVIL, an AI coding agent running inside a web application.
You operate on the user's virtual project through tools:
- list_files, read_file, write_file, delete_file, rename_file — manage project files
- search_files — find code across the project with a regular expression
- run_code — execute JavaScript or Python in a sandbox to test your work

Guidelines:
- When asked to build, change, or fix something, use the tools to make the change. Do not just describe it.
- write_file takes the COMPLETE new contents of a file, not a patch.
- Test non-trivial logic with run_code before declaring it done.
- Keep files small and self-contained where reasonable. Prefer clear, working code.
- After acting, give a short summary in markdown of what you changed.`;

function filesToRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of vfs.snapshot()) out[f.path] = f.content;
  return out;
}

function initialSessions(): SessionsState {
  const loaded = loadSessions();
  if (loaded) return loaded;
  const s = newSession(SYSTEM_PROMPT);
  return { activeId: s.id, sessions: [s] };
}

function withSystem(history: ChatMessage[]): ChatMessage[] {
  return history.length && history[0].role === "system"
    ? history
    : [{ role: "system", content: SYSTEM_PROMPT }, ...history];
}

export default function App() {
  const bootRef = useRef<SessionsState | undefined>(undefined);
  if (!bootRef.current) bootRef.current = initialSessions();
  const boot = bootRef.current;
  const bootSession = boot.sessions.find((s) => s.id === boot.activeId) ?? boot.sessions[0];

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [files, setFiles] = useState<Record<string, string>>(() => filesToRecord());
  const [openTabs, setOpenTabs] = useState<string[]>(() => vfs.list().slice(0, 1));
  const [activeFile, setActiveFile] = useState<string>(() => vfs.list()[0] ?? "");
  const [sessionsState, setSessionsState] = useState<SessionsState>(boot);
  const [items, setItems] = useState<Item[]>(bootSession.items);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [githubOpen, setGithubOpen] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([
    { level: "system", text: "ANVIL terminal — JavaScript + Python sandbox. Type `help`." },
  ]);

  const historyRef = useRef<ChatMessage[]>(withSystem(bootSession.history));
  const abortRef = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionsRef = useRef(sessionsState);
  sessionsRef.current = sessionsState;

  const activeSession =
    sessionsState.sessions.find((s) => s.id === sessionsState.activeId) ?? sessionsState.sessions[0];

  // ---- File view sync ------------------------------------------------------
  const refresh = useCallback(() => {
    const rec = filesToRecord();
    setFiles(rec);
    setOpenTabs((tabs) => tabs.filter((t) => rec[t] !== undefined));
    setActiveFile((cur) => (rec[cur] !== undefined ? cur : Object.keys(rec)[0] ?? ""));
  }, []);

  useEffect(() => {
    refresh();
    return vfs.subscribe(refresh);
  }, [refresh]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Persist the active session whenever the transcript changes.
  useEffect(() => {
    setSessionsState((st) => {
      const next: SessionsState = {
        activeId: st.activeId,
        sessions: st.sessions.map((s) =>
          s.id === st.activeId
            ? { ...s, items, history: historyRef.current, title: titleFor(items), updatedAt: Date.now() }
            : s
        ),
      };
      saveSessions(next);
      return next;
    });
  }, [items]);

  const provider = effectiveProvider(settings);

  const pushLog = useCallback((level: LogLine["level"], text: string) => {
    setLogs((l) => [...l, { level, text }]);
  }, []);

  // ---- File operations -----------------------------------------------------
  const openFile = (path: string) => {
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
    setActiveFile(path);
  };
  const createFile = (path: string) => {
    vfs.create(path, "");
    openFile(path);
  };
  const deleteFile = (path: string) => vfs.delete(path);
  const editFile = (path: string, value: string) => vfs.write(path, value);
  const closeTab = (path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      setActiveFile((cur) => (cur === path ? next[next.length - 1] ?? "" : cur));
      return next;
    });
  };

  // ---- Project import / export / reset ------------------------------------
  const exportProject = useCallback(() => {
    const blob = new Blob([serializeProject(vfs.snapshot())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anvil-project.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushLog("system", `Exported ${vfs.list().length} files.`);
  }, [pushLog]);

  const importProject = useCallback(
    async (file: File) => {
      if (vfs.list().length && !window.confirm("Importing replaces your current files. Continue?")) return;
      try {
        const parsed = parseProject(await file.text());
        vfs.replaceAll(parsed);
        pushLog("system", `Imported ${parsed.length} files from ${file.name}.`);
      } catch (e) {
        pushLog("error", `Import failed — ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [pushLog]
  );

  const pickImport = useCallback(() => {
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".json,application/json";
    el.onchange = () => {
      const f = el.files?.[0];
      if (f) void importProject(f);
    };
    el.click();
  }, [importProject]);

  const resetProject = useCallback(() => {
    if (!window.confirm("Reset to the starter files? Your current files will be replaced.")) return;
    vfs.reset();
    pushLog("system", "Project reset to the starter files.");
  }, [pushLog]);

  // ---- GitHub sync ---------------------------------------------------------
  const pullIntoWorkspace = useCallback(
    (incoming: VFile[]) => {
      if (
        vfs.list().length &&
        !window.confirm(`Replace your current files with ${incoming.length} files from GitHub?`)
      )
        return;
      vfs.replaceAll(incoming);
      pushLog("system", `Pulled ${incoming.length} files from GitHub.`);
    },
    [pushLog]
  );

  // ---- Image attachments ---------------------------------------------------
  const onAttachFiles = useCallback(
    async (list: File[]) => {
      const room = MAX_IMAGES - attachedImages.length;
      if (room <= 0) {
        pushLog("warn", `You can attach up to ${MAX_IMAGES} images per message.`);
        return;
      }
      for (const file of list.slice(0, room)) {
        try {
          const img = await readImageFile(file);
          setAttachedImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, img]));
        } catch (e) {
          pushLog("error", e instanceof Error ? e.message : String(e));
        }
      }
    },
    [attachedImages.length, pushLog]
  );

  const onRemoveImage = useCallback(
    (id: string) => setAttachedImages((prev) => prev.filter((i) => i.id !== id)),
    []
  );

  // ---- Sessions ------------------------------------------------------------
  const flushActive = () =>
    sessionsRef.current.sessions.map((s) =>
      s.id === sessionsRef.current.activeId
        ? { ...s, items, history: historyRef.current, title: titleFor(items) }
        : s
    );

  const switchSession = (id: string) => {
    if (id === sessionsRef.current.activeId) return;
    const sessions = flushActive();
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    historyRef.current = withSystem(target.history);
    setItems(target.items);
    const next: SessionsState = { activeId: id, sessions };
    saveSessions(next);
    setSessionsState(next);
  };

  const newChat = () => {
    const sessions = flushActive();
    const s = newSession(SYSTEM_PROMPT);
    historyRef.current = s.history;
    setItems([]);
    const next: SessionsState = { activeId: s.id, sessions: [s, ...sessions] };
    saveSessions(next);
    setSessionsState(next);
  };

  const deleteSession = (id: string) => {
    const st = sessionsRef.current;
    let sessions = st.sessions.filter((s) => s.id !== id);
    if (sessions.length === 0) {
      const s = newSession(SYSTEM_PROMPT);
      sessions = [s];
      historyRef.current = s.history;
      setItems([]);
      const next: SessionsState = { activeId: s.id, sessions };
      saveSessions(next);
      setSessionsState(next);
      return;
    }
    let activeId = st.activeId;
    if (activeId === id) {
      activeId = sessions[0].id;
      historyRef.current = withSystem(sessions[0].history);
      setItems(sessions[0].items);
    }
    const next: SessionsState = { activeId, sessions };
    saveSessions(next);
    setSessionsState(next);
  };

  // ---- Approval gate -------------------------------------------------------
  const approveWrite = useCallback(
    (path: string, before: string, after: string) =>
      new Promise<boolean>((resolve) => {
        if (settingsRef.current.autoApply) {
          resolve(true);
          return;
        }
        setPendingChange({ id: Math.random().toString(36).slice(2), path, before, after, resolve });
      }),
    []
  );

  // ---- Send / agent loop ---------------------------------------------------
  const send = async () => {
    const text = input.trim();
    if ((!text && attachedImages.length === 0) || busy) return;
    const p = effectiveProvider(settings);
    const apiKey = settings.apiKeys[settings.providerId] ?? "";

    if (settings.mode === "byok" && !apiKey) {
      setItems((it) => [
        ...it,
        { kind: "error", text: `No API key for ${p.label}. Open Settings to add one, or switch to the hosted proxy.` },
      ]);
      setSettingsOpen(true);
      return;
    }

    const chatImages: ChatImage[] = attachedImages.map((i) => ({
      mime: i.mime,
      data: i.data,
      dataUrl: i.dataUrl,
    }));
    const imageUrls = attachedImages.map((i) => i.dataUrl);
    setInput("");
    setAttachedImages([]);
    setItems((it) => [...it, { kind: "user", text, images: imageUrls.length ? imageUrls : undefined }]);
    historyRef.current.push({
      role: "user",
      content: expandMentions(text, files),
      images: chatImages.length ? chatImages : undefined,
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    const base = {
      provider: p,
      model: settings.model,
      mode: settings.mode,
      apiKey,
      temperature: settings.temperature,
      signal: controller.signal,
    };

    try {
      if (agentMode) {
        await runAgentTurn({
          base,
          messages: historyRef.current,
          ctx: { approveWrite },
          signal: controller.signal,
          cb: {
            onAssistantText: (t) => setItems((it) => [...it, { kind: "assistant", text: t }]),
            onToolStart: (name, args) => setItems((it) => [...it, { kind: "tool", name, args }]),
            onToolResult: (name, result) =>
              setItems((it) => {
                const copy = [...it];
                for (let i = copy.length - 1; i >= 0; i--) {
                  const c = copy[i];
                  if (c.kind === "tool" && c.name === name && c.result === undefined) {
                    copy[i] = { ...c, result };
                    break;
                  }
                }
                return copy;
              }),
          },
        });
      } else {
        setItems((it) => [...it, { kind: "assistant", text: "" }]);
        let acc = "";
        for await (const chunk of streamText({ ...base, messages: historyRef.current })) {
          acc += chunk;
          setItems((it) => {
            const copy = [...it];
            const last = copy[copy.length - 1];
            if (last && last.kind === "assistant") copy[copy.length - 1] = { kind: "assistant", text: acc };
            return copy;
          });
        }
        historyRef.current.push({ role: "assistant", content: acc });
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted) {
        setItems((it) => [
          ...it,
          { kind: "error", text: `Request failed — ${e instanceof Error ? e.message : String(e)}` },
        ]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  // ---- Run code ------------------------------------------------------------
  const runPath = useCallback(
    async (path: string) => {
      const code = files[path] ?? vfs.read(path) ?? "";
      const lang = languageOf(path);
      if (lang === "unknown") {
        pushLog("warn", `Don't know how to run "${path}". Use a .js or .py file.`);
        return;
      }
      pushLog("log", `run ${path}  (${lang})`);
      const r = await runCode(code, lang);
      r.logs.forEach((x) => pushLog(x.level, x.text));
      if (r.error && !r.logs.some((l) => l.level === "error")) pushLog("error", r.error);
      pushLog("system", `finished in ${r.durationMs}ms`);
    },
    [files, pushLog]
  );

  const onTerminalCommand = useCallback(
    (cmd: string) => {
      pushLog("log", `$ ${cmd}`);
      const [name, ...rest] = cmd.split(/\s+/);
      const arg = rest.join(" ");
      switch (name) {
        case "help":
          pushLog("system", "commands: ls · cat <file> · run <file> · python <file> · rm <file> · echo <text> · clear · help");
          break;
        case "ls":
          pushLog("system", vfs.list().join("  ") || "(empty)");
          break;
        case "cat": {
          const c = vfs.read(arg);
          pushLog("system", c === undefined ? `no such file: ${arg}` : c);
          break;
        }
        case "run":
        case "node":
        case "python":
        case "py":
          void runPath(arg);
          break;
        case "rm":
          if (vfs.exists(arg)) {
            vfs.delete(arg);
            pushLog("system", `removed ${arg}`);
          } else pushLog("error", `no such file: ${arg}`);
          break;
        case "echo":
          pushLog("system", arg);
          break;
        case "clear":
          setLogs([]);
          break;
        default:
          pushLog("error", `unknown command: ${name}. Type \`help\`.`);
      }
    },
    [pushLog, runPath]
  );

  // ---- Command palette -----------------------------------------------------
  const commands: Command[] = [
    { id: "new-chat", label: "New chat", run: newChat },
    {
      id: "new-file",
      label: "New file",
      run: () => {
        const p = window.prompt("New file path", "src/untitled.js");
        if (p) createFile(p);
      },
    },
    { id: "run", label: "Run active file", run: () => activeFile && void runPath(activeFile) },
    { id: "export", label: "Export project (.json)", run: exportProject },
    { id: "import", label: "Import project…", run: pickImport },
    { id: "reset", label: "Reset project to starter", run: resetProject },
    {
      id: "theme",
      label: `Switch to ${settings.theme === "dark" ? "light" : "dark"} theme`,
      run: () => setSettings((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
    },
    { id: "agent", label: `Turn agent mode ${agentMode ? "off" : "on"}`, run: () => setAgentMode((v) => !v) },
    { id: "settings", label: "Open settings", run: () => setSettingsOpen(true) },
    { id: "github", label: "GitHub: sync a repository", run: () => setGithubOpen(true) },
    { id: "clear-term", label: "Clear terminal", run: () => setLogs([]) },
  ];

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const modelChip = useMemo(() => `${provider.label} · ${settings.model}`, [provider, settings.model]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span> ANVIL
          <span className="brand-sub">AI coding agent</span>
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={() => setPaletteOpen(true)} title="Command palette (Ctrl/⌘ K)">
            ⌘K
          </button>
          <span className="model-chip" title="Active provider and model">
            {modelChip}
          </span>
          <button className="btn ghost" onClick={() => setGithubOpen(true)} title="Sync with a GitHub repo">
            GitHub
          </button>
          <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      <div className="workspace">
        <div className="left">
          <SessionList
            sessions={sessionsState.sessions}
            activeId={sessionsState.activeId}
            onSelect={switchSession}
            onNew={newChat}
            onDelete={deleteSession}
          />
          <FileExplorer
            files={vfs.list()}
            active={activeFile}
            onSelect={openFile}
            onCreate={createFile}
            onDelete={deleteFile}
            onExport={exportProject}
            onImport={importProject}
            onReset={resetProject}
          />
        </div>
        <ChatPanel
          items={items}
          input={input}
          setInput={setInput}
          onSend={send}
          onStop={stop}
          busy={busy}
          agentMode={agentMode}
          setAgentMode={setAgentMode}
          files={vfs.list()}
          images={attachedImages}
          onAttachFiles={onAttachFiles}
          onRemoveImage={onRemoveImage}
        />
        <div className="right">
          {pendingChange ? (
            <section className="editor">
              <div className="monaco-wrap">
                <div className="empty-state">
                  <p>Reviewing a change…</p>
                  <span>Approve or reject the diff to continue.</span>
                </div>
              </div>
            </section>
          ) : (
            <EditorPanel
              tabs={openTabs}
              active={activeFile}
              files={files}
              onSelect={openFile}
              onClose={closeTab}
              onChange={editFile}
              onRun={() => activeFile && void runPath(activeFile)}
              theme={settings.theme}
            />
          )}
          <TerminalPanel logs={logs} onCommand={onTerminalCommand} />
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal settings={settings} onSave={setSettings} onClose={() => setSettingsOpen(false)} />
      )}

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}

      {githubOpen && (
        <GitHubPanel
          token={settings.githubToken}
          onTokenChange={(t) => setSettings((s) => ({ ...s, githubToken: t }))}
          onPullIntoWorkspace={pullIntoWorkspace}
          onClose={() => setGithubOpen(false)}
        />
      )}

      {pendingChange && (
        <DiffReview
          change={pendingChange}
          theme={settings.theme}
          onApply={() => {
            pendingChange.resolve(true);
            setPendingChange(null);
          }}
          onReject={() => {
            pendingChange.resolve(false);
            setPendingChange(null);
          }}
        />
      )}
    </div>
  );
}
