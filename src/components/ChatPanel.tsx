import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "../lib/markdown";
import { suggestMentions } from "../lib/mentions";
import type { TranscriptItem } from "../types";

export type Item = TranscriptItem;

interface Props {
  items: Item[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  agentMode: boolean;
  setAgentMode: (v: boolean) => void;
  files: string[];
}

function prettyArgs(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}

function toolSummary(name: string, args: string): string {
  try {
    const a = JSON.parse(args);
    if (a.path) return `${name}(${a.path})`;
    if (a.pattern) return `${name}(/${a.pattern}/)`;
  } catch {
    /* ignore */
  }
  return name;
}

export function ChatPanel({
  items,
  input,
  setInput,
  onSend,
  onStop,
  busy,
  agentMode,
  setAgentMode,
  files,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  // Detect a trailing "@fragment" to offer file suggestions.
  const mentionFragment = useMemo(() => {
    const m = /(?:^|\s)@([A-Za-z0-9_./-]*)$/.exec(input);
    return m ? m[1] : null;
  }, [input]);

  const suggestions = useMemo(
    () => (mentionFragment !== null ? suggestMentions(mentionFragment, files) : []),
    [mentionFragment, files]
  );

  const insertMention = (path: string) => {
    setInput(input.replace(/@([A-Za-z0-9_./-]*)$/, `@${path} `));
    taRef.current?.focus();
  };

  const menuOpen = mentionFragment !== null && suggestions.length > 0;

  return (
    <section className="chat">
      <div className="pane-head">
        <span>Chat</span>
        <label className="agent-toggle" title="Let the model read and write project files">
          <input
            type="checkbox"
            checked={agentMode}
            onChange={(e) => setAgentMode(e.target.checked)}
          />
          Agent
        </label>
      </div>

      <div className="transcript">
        {items.length === 0 && (
          <div className="welcome">
            <h2>ANVIL</h2>
            <p>A web-based, provider-agnostic AI coding agent.</p>
            <ul>
              <li>Turn on <strong>Agent</strong> and ask it to build or refactor files.</li>
              <li>Type <strong>@</strong> to attach a file's contents to your prompt.</li>
              <li>Press <strong>⌘K</strong> / <strong>Ctrl K</strong> for the command palette.</li>
              <li>Every file write is shown as a diff you approve.</li>
            </ul>
          </div>
        )}

        {items.map((it, i) => {
          if (it.kind === "user") {
            return (
              <div key={i} className="msg user">
                {it.text}
              </div>
            );
          }
          if (it.kind === "error") {
            return (
              <div key={i} className="msg error">
                {it.text}
              </div>
            );
          }
          if (it.kind === "assistant") {
            return (
              <div key={i} className="msg assistant">
                <div
                  className="md"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(it.text) }}
                />
              </div>
            );
          }
          return (
            <details key={i} className="tool-call">
              <summary>
                <span className="tool-badge">tool</span> {toolSummary(it.name, it.args)}
                {it.result === undefined && <span className="dot-pulse" />}
              </summary>
              <div className="tool-body">
                <div className="tool-section-label">arguments</div>
                <pre>{prettyArgs(it.args)}</pre>
                {it.result !== undefined && (
                  <>
                    <div className="tool-section-label">result</div>
                    <pre>{it.result}</pre>
                  </>
                )}
              </div>
            </details>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="composer-wrap">
        {menuOpen && (
          <ul className="mention-menu">
            {suggestions.map((f, i) => (
              <li
                key={f}
                className={i === 0 ? "mention-item active" : "mention-item"}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(f);
                }}
              >
                {f}
              </li>
            ))}
          </ul>
        )}
        <div className="composer">
          <textarea
            ref={taRef}
            value={input}
            placeholder={agentMode ? "Ask ANVIL to build, refactor or fix…  (@ to attach a file)" : "Ask ANVIL anything…"}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (menuOpen && (e.key === "Enter" || e.key === "Tab")) {
                e.preventDefault();
                insertMention(suggestions[0]);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={3}
          />
          {busy ? (
            <button className="btn danger" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className="btn primary" onClick={onSend} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
