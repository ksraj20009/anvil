import { describe, it, expect } from "vitest";
import {
  parseModelList,
  filterChatModels,
  toOpenAIMessages,
  toAnthropicMessages,
} from "../src/lib/llm";
import type { ChatMessage } from "../src/types";

describe("parseModelList", () => {
  it("reads the OpenAI shape", () => {
    expect(parseModelList({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] })).toEqual([
      "gpt-4o",
      "gpt-4o-mini",
    ]);
  });

  it("reads the Anthropic shape", () => {
    expect(
      parseModelList({
        data: [{ type: "model", id: "claude-sonnet-4-20250514", display_name: "Claude Sonnet 4" }],
      })
    ).toEqual(["claude-sonnet-4-20250514"]);
  });

  it("reads a plain array and de-duplicates", () => {
    expect(parseModelList(["a", "a", "b"])).toEqual(["a", "b"]);
  });

  it("handles junk without throwing", () => {
    expect(parseModelList(null)).toEqual([]);
    expect(parseModelList({ foo: 1 })).toEqual([]);
    expect(parseModelList({ data: [{ nope: true }] })).toEqual([]);
  });
});

describe("filterChatModels", () => {
  it("drops non-conversational models and sorts", () => {
    const out = filterChatModels([
      "gpt-4o",
      "text-embedding-3-large",
      "whisper-1",
      "gpt-4o-mini",
      "tts-1",
      "dall-e-3",
    ]);
    expect(out).toEqual(["gpt-4o", "gpt-4o-mini"]);
  });

  it("keeps grok and claude models", () => {
    expect(filterChatModels(["grok-3", "claude-sonnet-4-20250514"])).toEqual([
      "claude-sonnet-4-20250514",
      "grok-3",
    ]);
  });
});

describe("toOpenAIMessages", () => {
  it("maps assistant tool calls and tool results", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "read_file", arguments: '{"path":"a"}' }],
      },
      { role: "tool", toolCallId: "c1", name: "read_file", content: "file body" },
    ];
    const out = toOpenAIMessages(msgs) as any[];
    expect(out[0]).toEqual({ role: "system", content: "sys" });
    expect(out[2].content).toBeNull();
    expect(out[2].tool_calls[0].function.name).toBe("read_file");
    expect(out[3]).toEqual({ role: "tool", tool_call_id: "c1", content: "file body" });
  });
});

describe("toAnthropicMessages", () => {
  it("extracts system and merges consecutive tool results into one user turn", () => {
    const msgs: ChatMessage[] = [
      { role: "system", content: "S" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "ok",
        toolCalls: [
          { id: "t1", name: "list_files", arguments: "{}" },
          { id: "t2", name: "read_file", arguments: '{"path":"a"}' },
        ],
      },
      { role: "tool", toolCallId: "t1", content: "r1" },
      { role: "tool", toolCallId: "t2", content: "r2" },
    ];
    const { system, messages } = toAnthropicMessages(msgs) as any;

    expect(system).toBe("S");
    expect(messages.find((m: any) => m.role === "system")).toBeUndefined();

    const assistant = messages.find((m: any) => m.role === "assistant");
    expect(assistant.content.filter((b: any) => b.type === "tool_use").length).toBe(2);

    const last = messages[messages.length - 1];
    expect(last.role).toBe("user");
    expect(Array.isArray(last.content)).toBe(true);
    expect(last.content.map((b: any) => b.tool_use_id)).toEqual(["t1", "t2"]);
  });
});
