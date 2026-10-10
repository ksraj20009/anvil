import Editor from "@monaco-editor/react";

interface Props {
  tabs: string[];
  active: string;
  files: Record<string, string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, value: string) => void;
  onRun: () => void;
  theme: "dark" | "light";
}

const LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  md: "markdown",
  py: "python",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  rb: "ruby",
  php: "php",
};

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG[ext] ?? "plaintext";
}

export function EditorPanel({
  tabs,
  active,
  files,
  onSelect,
  onClose,
  onChange,
  onRun,
  theme,
}: Props) {
  return (
    <section className="editor">
      <div className="tabs">
        <div className="tab-strip">
          {tabs.map((t) => (
            <div
              key={t}
              className={t === active ? "tab active" : "tab"}
              onClick={() => onSelect(t)}
            >
              <span className="tab-name">{t}</span>
              <button
                className="tab-close"
                title="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={onRun} disabled={!active}>
          ▶ Run
        </button>
      </div>

      <div className="monaco-wrap">
        {active ? (
          <Editor
            theme={theme === "light" ? "vs" : "vs-dark"}
            path={active}
            language={languageFor(active)}
            value={files[active] ?? ""}
            onChange={(v) => onChange(active, v ?? "")}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              tabSize: 2,
              smoothScrolling: true,
              padding: { top: 10 },
            }}
          />
        ) : (
          <div className="empty-state">
            <p>No file open.</p>
            <span>Pick one from the Explorer, or ask ANVIL to create something.</span>
          </div>
        )}
      </div>
    </section>
  );
}
