import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LogLine } from "../types";

interface Props {
  logs: LogLine[];
  onCommand: (cmd: string) => void;
}

export function TerminalPanel({ logs, onCommand }: Props) {
  const [cmd, setCmd] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [logs]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = cmd.trim();
    if (!c) return;
    history.current.push(c);
    histIdx.current = history.current.length;
    onCommand(c);
    setCmd("");
  };

  return (
    <section className="terminal">
      <div className="pane-head">
        <span>Terminal</span>
        <span className="hint">type `help`</span>
      </div>
      <div className="term-body">
        {logs.map((l, i) => (
          <div key={i} className={`line ${l.level}`}>
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="term-input" onSubmit={submit}>
        <span className="prompt">$</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (histIdx.current > 0) {
                histIdx.current -= 1;
                setCmd(history.current[histIdx.current] ?? "");
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              if (histIdx.current < history.current.length - 1) {
                histIdx.current += 1;
                setCmd(history.current[histIdx.current] ?? "");
              } else {
                histIdx.current = history.current.length;
                setCmd("");
              }
            }
          }}
          placeholder="run app.js"
          spellCheck={false}
        />
      </form>
    </section>
  );
}
