import { useEffect, useRef } from "react";
import { renderMarkdown } from "../lib/markdown";

export type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; args: string; result?: string }
  | { kind: "error"; text: string };

interface Props {
  items: Item[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  agentMode: boolean;
  setAgentMode: (v: boolean) => void;
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
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

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
              <li>Every file write is shown as a diff you approve.</li>
              <li>Run JavaScript in the sandboxed terminal.</li>
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

      <div className="composer">
        <textarea
          value={input}
          placeholder={agentMode ? "Ask ANVIL to build, refactor or fix…" : "Ask ANVIL anything…"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
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
    </section>
  );
}
