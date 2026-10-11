import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "../lib/markdown";
import { suggestMentions } from "../lib/mentions";
import { formatBytes, type AttachedImage } from "../lib/vision";
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
  images: AttachedImage[];
  onAttachFiles: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
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
  images,
  onAttachFiles,
  onRemoveImage,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

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

  const toggleMic = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => any;
      webkitSpeechRecognition?: new () => any;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInput(`${base} ${text}`.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <section className="chat">
      <div className="pane-head">
        <span>Chat</span>
        <label className="agent-toggle" title="Let the model read and write project files">
          <input type="checkbox" checked={agentMode} onChange={(e) => setAgentMode(e.target.checked)} />
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
              <li>Type <strong>@</strong> to attach a file, or the image button for screenshots.</li>
              <li>Press <strong>⌘K</strong> / <strong>Ctrl K</strong> for the command palette.</li>
              <li>Every file write is shown as a diff you approve.</li>
            </ul>
          </div>
        )}

        {items.map((it, i) => {
          if (it.kind === "user") {
            return (
              <div key={i} className="msg user">
                {it.images && it.images.length > 0 && (
                  <div className="msg-images">
                    {it.images.map((src, k) => (
                      <img key={k} src={src} alt="attachment" />
                    ))}
                  </div>
                )}
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
                <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(it.text) }} />
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
        {images.length > 0 && (
          <div className="attachments">
            {images.map((img) => (
              <div key={img.id} className="attachment" title={`${img.name} · ${formatBytes(img.size)}`}>
                <img src={img.dataUrl} alt={img.name} />
                <button className="attachment-x" onClick={() => onRemoveImage(img.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              if (list.length) onAttachFiles(list);
              e.target.value = "";
            }}
          />
          <button className="icon-btn" title="Attach image" onClick={() => fileRef.current?.click()}>
            🖼
          </button>
          <button
            className={listening ? "icon-btn rec" : "icon-btn"}
            title={speechSupported ? "Dictate" : "Speech recognition unavailable"}
            onClick={toggleMic}
            disabled={!speechSupported}
          >
            🎤
          </button>
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
            <button className="btn primary" onClick={onSend} disabled={!input.trim() && images.length === 0}>
              Send
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
