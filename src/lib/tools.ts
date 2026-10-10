import type { ToolDef } from "../types";
import { vfs } from "./vfs";
import { runInSandbox } from "./sandbox";

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
    name: "run_code",
    description:
      "Execute a JavaScript snippet in a sandboxed worker and return its console output. Use this to test code you write.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "JavaScript to execute." } },
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
    case "run_code": {
      const r = await runInSandbox(String(args.code ?? ""));
      const out = r.logs.map((l) => `[${l.level}] ${l.text}`).join("\n");
      return (out || "(no output)") + (r.error ? `\nExecution error: ${r.error}` : "");
    }
    default:
      return `Error: unknown tool "${name}".`;
  }
}
