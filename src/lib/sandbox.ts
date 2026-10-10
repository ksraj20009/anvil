/**
 * Sandboxed code execution.
 *
 * JavaScript runs inside a dedicated Web Worker created from a Blob — it has no
 * DOM access and cannot touch the host page. console.* output is forwarded back
 * to the UI, and a timeout kills runaway loops.
 *
 * Non-JS languages are intentionally out of scope for the client sandbox; that
 * belongs on a server or a WASM runtime (a roadmap item).
 */
export interface RunLog {
  level: "log" | "info" | "warn" | "error";
  text: string;
}

export interface RunResult {
  logs: RunLog[];
  error?: string;
  durationMs: number;
}

const WORKER_SRC = `
function fmt(v) {
  try {
    if (typeof v === "string") return v;
    if (typeof v === "function") return "[Function]";
    if (v instanceof Error) return v.stack || String(v);
    return JSON.stringify(v, (k, val) => (typeof val === "function" ? "[Function]" : val));
  } catch (e) {
    return String(v);
  }
}
self.onmessage = function (e) {
  var send = function (level, args) {
    self.postMessage({ type: "log", level: level, text: args.map(fmt).join(" ") });
  };
  console.log = function () { send("log", [].slice.call(arguments)); };
  console.info = function () { send("info", [].slice.call(arguments)); };
  console.warn = function () { send("warn", [].slice.call(arguments)); };
  console.error = function () { send("error", [].slice.call(arguments)); };
  try {
    var result = (0, eval)(e.data);
    if (result !== undefined) send("log", [result]);
    self.postMessage({ type: "done" });
  } catch (err) {
    self.postMessage({ type: "error", text: err && err.stack ? err.stack : String(err) });
  }
};
`;

export function runInSandbox(code: string, timeoutMs = 5000): Promise<RunResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    const logs: RunLog[] = [];
    let finished = false;

    const finish = (error?: string) => {
      if (finished) return;
      finished = true;
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ logs, error, durationMs: Math.round(performance.now() - started) });
    };

    const timer = setTimeout(() => {
      logs.push({
        level: "error",
        text: `Execution timed out after ${timeoutMs}ms (possible infinite loop).`,
      });
      finish("timeout");
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const d = e.data || {};
      if (d.type === "log") logs.push({ level: d.level, text: d.text });
      else if (d.type === "error") {
        logs.push({ level: "error", text: d.text });
        clearTimeout(timer);
        finish(d.text);
      } else if (d.type === "done") {
        clearTimeout(timer);
        finish();
      }
    };
    worker.onerror = (e: ErrorEvent) => {
      logs.push({ level: "error", text: e.message });
      clearTimeout(timer);
      finish(e.message);
    };

    worker.postMessage(code);
  });
}
