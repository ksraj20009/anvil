import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, LogLine, PendingChange, Settings } from "./types";
import { vfs } from "./lib/vfs";
import { loadSettings, saveSettings } from "./lib/storage";
import { getProvider } from "./lib/providers";
import { streamText } from "./lib/llm";
import { runAgentTurn } from "./lib/agent";
import { runInSandbox } from "./lib/sandbox";
import { FileExplorer } from "./components/FileExplorer";
import { EditorPanel } from "./components/EditorPanel";
import { ChatPanel, type Item } from "./components/ChatPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import { SettingsModal } from "./components/SettingsModal";
import { DiffReview } from "./components/DiffReview";

const SYSTEM_PROMPT = `You are ANVIL, an AI coding agent running inside a web application.
You operate on the user's virtual project through tools:
- list_files, read_file, write_file, delete_file — manage project files
- run_code — execute JavaScript in a sandbox to test your work

Guidelines:
- When asked to build, change, or fix something, use the tools to make the change. Do not just describe it.
- write_file takes the COMPLETE new contents of a file, not a patch.
- Keep files small and self-contained where reasonable. Prefer clear, working code.
- After acting, give a short summary in markdown of what you changed.`;

function filesToRecord(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of vfs.snapshot()) out[f.path] = f.content;
  return out;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [files, setFiles] = useState<Record<string, string>>(() => filesToRecord());
  const [openTabs, setOpenTabs] = useState<string[]>(() => vfs.list().slice(0, 1));
  const [activeFile, setActiveFile] = useState<string>(() => vfs.list()[0] ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([
    { level: "system", text: "ANVIL terminal — JavaScript sandbox. Type `help`." },
  ]);

  const historyRef = useRef<ChatMessage[]>([{ role: "system", content: SYSTEM_PROMPT }]);
  const abortRef = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Keep the file view in sync with the VFS.
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

  const provider = getProvider(settings.providerId);

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
  const deleteFile = (path: string) => {
    vfs.delete(path);
  };
  const editFile = (path: string, value: string) => {
    vfs.write(path, value);
  };
  const closeTab = (path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      setActiveFile((cur) => (cur === path ? next[next.length - 1] ?? "" : cur));
      return next;
    });
  };

  // ---- Approval gate for agent writes -------------------------------------
  const approveWrite = useCallback(
    (path: string, before: string, after: string) =>
      new Promise<boolean>((resolve) => {
        if (settingsRef.current.autoApply) {
          resolve(true);
          return;
        }
        setPendingChange({
          id: Math.random().toString(36).slice(2),
          path,
          before,
          after,
          resolve,
        });
      }),
    []
  );

  // ---- Send / agent loop ---------------------------------------------------
  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const p = getProvider(settings.providerId);
    const apiKey = settings.apiKeys[settings.providerId] ?? "";

    if (settings.mode === "byok" && !apiKey) {
      setItems((it) => [
        ...it,
        {
          kind: "error",
          text: `No API key for ${p.label}. Open Settings to add one, or switch to the hosted proxy.`,
        },
      ]);
      setSettingsOpen(true);
      return;
    }

    setInput("");
    setItems((it) => [...it, { kind: "user", text }]);
    historyRef.current.push({ role: "user", content: text });

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
            onAssistantText: (t) =>
              setItems((it) => [...it, { kind: "assistant", text: t }]),
            onToolStart: (name, args) =>
              setItems((it) => [...it, { kind: "tool", name, args }]),
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

  const newChat = () => {
    historyRef.current = [{ role: "system", content: SYSTEM_PROMPT }];
    setItems([]);
  };

  // ---- Run code ------------------------------------------------------------
  const runPath = useCallback(
    async (path: string) => {
      const code = files[path] ?? vfs.read(path) ?? "";
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      if (!["js", "mjs", "cjs"].includes(ext)) {
        pushLog("warn", `Only JavaScript runs in the browser sandbox (got .${ext || "?"}).`);
        return;
      }
      pushLog("log", `run ${path}`);
      const r = await runInSandbox(code);
      r.logs.forEach((x) => pushLog(x.level, x.text));
      if (r.error) pushLog("error", r.error);
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
          pushLog("system", "commands: ls · cat <file> · run <file> · rm <file> · echo <text> · clear · help");
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

  const modelChip = useMemo(() => `${provider.label} · ${settings.model}`, [provider, settings.model]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span> ANVIL
          <span className="brand-sub">AI coding agent</span>
        </div>
        <div className="top-actions">
          <span className="model-chip" title="Active provider and model">
            {modelChip}
          </span>
          <button className="btn ghost" onClick={newChat}>
            New chat
          </button>
          <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      <div className="workspace">
        <FileExplorer
          files={vfs.list()}
          active={activeFile}
          onSelect={openFile}
          onCreate={createFile}
          onDelete={deleteFile}
        />
        <ChatPanel
          items={items}
          input={input}
          setInput={setInput}
          onSend={send}
          onStop={stop}
          busy={busy}
          agentMode={agentMode}
          setAgentMode={setAgentMode}
        />
        <div className="right">
          <EditorPanel
            tabs={openTabs}
            active={activeFile}
            files={files}
            onSelect={openFile}
            onClose={closeTab}
            onChange={editFile}
            onRun={() => activeFile && void runPath(activeFile)}
          />
          <TerminalPanel logs={logs} onCommand={onTerminalCommand} />
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingChange && (
        <DiffReview
          change={pendingChange}
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
