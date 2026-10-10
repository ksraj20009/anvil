import { DiffEditor } from "@monaco-editor/react";
import type { PendingChange } from "../types";
import { diffStat } from "../lib/diff";

interface Props {
  change: PendingChange;
  onApply: () => void;
  onReject: () => void;
  theme: "dark" | "light";
}

const LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  html: "html",
  css: "css",
  md: "markdown",
  py: "python",
};

function languageFor(path: string): string {
  return LANG[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext";
}

export function DiffReview({ change, onApply, onReject, theme }: Props) {
  const stat = diffStat(change.before, change.after);
  const isNew = change.before.length === 0;

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <div className="modal-head">
          <h2>
            Review change — <code>{change.path}</code>
          </h2>
          <div className="diff-stat">
            <span className="add">+{stat.added}</span>
            <span className="rem">-{stat.removed}</span>
          </div>
        </div>

        <p className="field-hint">
          {isNew
            ? "The agent wants to create this file."
            : "The agent wants to modify this file. Left is current, right is proposed."}
        </p>

        <div className="diff-wrap">
          <DiffEditor
            theme={theme === "light" ? "vs" : "vs-dark"}
            language={languageFor(change.path)}
            original={change.before}
            modified={change.after}
            options={{
              renderSideBySide: true,
              readOnly: true,
              fontSize: 13,
              minimap: { enabled: false },
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn danger" onClick={onReject}>
            Reject
          </button>
          <button className="btn primary" onClick={onApply}>
            Apply change
          </button>
        </div>
      </div>
    </div>
  );
}
