import { describe, it, expect } from "vitest";
import { toOpenAIMessages, toAnthropicMessages } from "../src/lib/llm";
import type { ChatMessage } from "../src/types";

const withImage: ChatMessage = {
  role: "user",
  content: "what is this?",
  images: [{ mime: "image/png", data: "AAAA", dataUrl: "data:image/png;base64,AAAA" }],
};

describe("image message conversion", () => {
  it("OpenAI: emits a content array with image_url", () => {
    const out = toOpenAIMessages([withImage]) as any[];
    expect(Array.isArray(out[0].content)).toBe(true);
    expect(out[0].content[0]).toEqual({ type: "text", text: "what is this?" });
    expect(out[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAAA" },
    });
  });

  it("Anthropic: emits an image block with a base64 source", () => {
    const { messages } = toAnthropicMessages([withImage]) as any;
    const user = messages[0];
    expect(user.role).toBe("user");
    const img = user.content.find((b: any) => b.type === "image");
    expect(img.source).toEqual({ type: "base64", media_type: "image/png", data: "AAAA" });
    const txt = user.content.find((b: any) => b.type === "text");
    expect(txt.text).toBe("what is this?");
  });

  it("leaves text-only messages unchanged", () => {
    const out = toOpenAIMessages([{ role: "user", content: "hi" }]) as any[];
    expect(out[0]).toEqual({ role: "user", content: "hi" });
  });
});
