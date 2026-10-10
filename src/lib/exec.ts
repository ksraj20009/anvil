import { runInSandbox, type RunResult } from "./sandbox";
import { runPython } from "./python";

export type RunLanguage = "javascript" | "python" | "unknown";

const PY_EXT = ["py"];
const JS_EXT = ["js", "mjs", "cjs", "jsx"];

/** Map a file path to a runnable language. */
export function languageOf(path: string): RunLanguage {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (JS_EXT.includes(ext)) return "javascript";
  if (PY_EXT.includes(ext)) return "python";
  return "unknown";
}

/** Execute code in the right runtime for the language. */
export async function runCode(code: string, language: string): Promise<RunResult> {
  if (language === "python") return runPython(code);
  if (language === "javascript" || language === "js") return runInSandbox(code);
  return {
    logs: [{ level: "error", text: `Unsupported language: ${language}. Use javascript or python.` }],
    error: "unsupported",
    durationMs: 0,
  };
}
