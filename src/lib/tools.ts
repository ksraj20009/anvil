import type { ToolDef } from "../types";
import { vfs } from "./vfs";
import { runCode } from "./exec";

/**
 * The agent's toolbox. These are advertised to the model and executed against
 * the browser VFS + sandbox. write_file goes through the review gate so the
 * user approves every change unless auto-apply is on.
 */
export const AGENT_TOOLS: ToolDef[] = [
  {
    name: "list_files",
    description: "List every file path in the current project.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_file",
    description: "Read the full contents of a single file.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "The file path to read." } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing one with the given full contents. Returns whether the user applied the change.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "The file path to write." },
        content: { type: "string", description: "The complete new contents of the file." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the project.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "The file path to delete." } },
      required: ["path"],
    },
  },
  {
    name: "rename_file",
    description: "Rename or move a file within the project.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Existing file path." },
        to: { type: "string", description: "New file path." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "search_files",
    description:
      "Search the project's file contents with a JavaScript regular expression. Returns matching lines as `path:line: text`. Use this to find code across files.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "A regular expression to match (case-insensitive)." },
        path: {
          type: "string",
          description: "Optional substring filter to restrict which file paths are searched.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_code",
    description:
      "Execute code in a sandbox and return its console/stdout output. Supports 'javascript' (Web Worker) and 'python' (Pyodide). Use this to test the code you write.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The source code to execute." },
        language: {
          type: "string",
          enum: ["javascript", "python"],
          description: "Which runtime to use. Defaults to javascript.",
        },
      },
      required: ["code"],
    },
  },
];

export interface ToolContext {
  /** Ask the user to approve a file write. Resolves true to apply. */
  approveWrite: (path: string, before: string, after: string) => Promise<boolean>;
}

export async function executeTool(
  name: string,
  argsJson: string,
  ctx: ToolContext
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    return "Error: arguments were not valid JSON.";
  }

  switch (name) {
    case "list_files": {
      const files = vfs.list();
      return files.length ? files.join("\n") : "(the project is empty)";
    }
    case "read_file": {
      const path = String(args.path ?? "");
      const content = vfs.read(path);
      return content === undefined ? `Error: no such file: ${path}` : content;
    }
    case "write_file": {
      const path = String(args.path ?? "");
      const after = String(args.content ?? "");
      const before = vfs.read(path) ?? "";
      const approved = await ctx.approveWrite(path, before, after);
      if (!approved) {
        return `The user rejected the change to ${path}. Do not retry the same write; ask what should change instead.`;
      }
      vfs.write(path, after);
      return `Wrote ${after.split("\n").length} lines to ${path}.`;
    }
    case "delete_file": {
      const path = String(args.path ?? "");
      if (!vfs.exists(path)) return `Error: no such file: ${path}`;
      vfs.delete(path);
      return `Deleted ${path}.`;
    }
    case "rename_file": {
      const from = String(args.from ?? "");
      const to = String(args.to ?? "");
      if (!vfs.exists(from)) return `Error: no such file: ${from}`;
      if (vfs.exists(to)) return `Error: ${to} already exists.`;
      vfs.rename(from, to);
      return `Renamed ${from} → ${to}.`;
    }
    case "search_files": {
      const pattern = String(args.pattern ?? "");
      const filter = args.path ? String(args.path) : "";
      let re: RegExp;
      try {
        re = new RegExp(pattern, "i");
      } catch {
        return "Error: that was not a valid regular expression.";
      }
      const hits: string[] = [];
      for (const p of vfs.list()) {
        if (filter && !p.includes(filter)) continue;
        const content = vfs.read(p) ?? "";
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            hits.push(`${p}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
            if (hits.length >= 200) break;
          }
        }
        if (hits.length >= 200) break;
      }
      return hits.length ? hits.join("\n") : "No matches.";
    }
    case "run_code": {
      const language = String(args.language ?? "javascript");
      const r = await runCode(String(args.code ?? ""), language);
      const out = r.logs.map((l) => `[${l.level}] ${l.text}`).join("\n");
      return (out || "(no output)") + (r.error ? `\nExecution error: ${r.error}` : "");
    }
    default:
      return `Error: unknown tool "${name}".`;
  }
}
