import type { ChatMessage } from "../types";
import { complete, type ChatRequest } from "./llm";
import { AGENT_TOOLS, executeTool, type ToolContext } from "./tools";

export interface AgentCallbacks {
  onAssistantText: (text: string) => void;
  onToolStart: (name: string, args: string) => void;
  onToolResult: (name: string, result: string) => void;
}

/**
 * The agentic loop: repeatedly ask the model for the next step. If it requests
 * tools, run them and feed the results back; otherwise it's done.
 *
 * `messages` is the live conversation and is mutated in place (assistant turns
 * and tool results are appended) so the caller keeps full history.
 */
export async function runAgentTurn(opts: {
  base: Omit<ChatRequest, "messages" | "tools">;
  messages: ChatMessage[];
  ctx: ToolContext;
  cb: AgentCallbacks;
  signal?: AbortSignal;
  maxSteps?: number;
}): Promise<void> {
  const { base, messages, ctx, cb, signal, maxSteps = 8 } = opts;

  for (let step = 0; step < maxSteps; step++) {
    const { text, toolCalls } = await complete({ ...base, messages, tools: AGENT_TOOLS, signal });

    const assistant: ChatMessage = {
      role: "assistant",
      content: text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
    messages.push(assistant);
    if (text) cb.onAssistantText(text);

    if (!toolCalls.length) return;

    for (const tc of toolCalls) {
      cb.onToolStart(tc.name, tc.arguments);
      let result: string;
      try {
        result = await executeTool(tc.name, tc.arguments, ctx);
      } catch (e) {
        result = `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
      cb.onToolResult(tc.name, result);
      messages.push({ role: "tool", toolCallId: tc.id, name: tc.name, content: result });
    }
  }

  messages.push({
    role: "assistant",
    content: "_(Stopped after reaching the maximum number of steps.)_",
  });
}
