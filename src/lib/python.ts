/**
 * Python execution in the browser via Pyodide (CPython compiled to WebAssembly).
 *
 * Loaded lazily from a CDN on first use, so it costs nothing until the user (or
 * the agent) actually runs Python. stdout/stderr are captured and returned in
 * the same shape as the JavaScript sandbox.
 */
import type { RunLog, RunResult } from "./sandbox";

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<PyodideAPI> | null = null;

interface PyodideAPI {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
  loadPackagesFromImports?: (code: string) => Promise<void>;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Pyodide from the CDN."));
    document.head.appendChild(s);
  });
}

export function pyodideReady(): boolean {
  return pyodidePromise !== null;
}

export async function getPyodide(): Promise<PyodideAPI> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_BASE}pyodide.js`);
      const loader = (window as unknown as { loadPyodide?: (o: { indexURL: string }) => Promise<PyodideAPI> })
        .loadPyodide;
      if (!loader) throw new Error("Pyodide failed to initialise.");
      return loader({ indexURL: PYODIDE_BASE });
    })();
  }
  return pyodidePromise;
}

export async function runPython(code: string): Promise<RunResult> {
  const started = performance.now();
  const logs: RunLog[] = [];
  try {
    const py = await getPyodide();
    py.setStdout({ batched: (s: string) => logs.push({ level: "log", text: s }) });
    py.setStderr({ batched: (s: string) => logs.push({ level: "error", text: s }) });
    const result = await py.runPythonAsync(code);
    if (result !== undefined && result !== null && String(result).length) {
      logs.push({ level: "log", text: String(result) });
    }
    return { logs, durationMs: Math.round(performance.now() - started) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logs.push({ level: "error", text: message });
    return { logs, error: message, durationMs: Math.round(performance.now() - started) };
  }
}
