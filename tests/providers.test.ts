import { describe, it, expect } from "vitest";
import { detectProviderFromKey, getProvider, effectiveProvider, PROVIDERS } from "../src/lib/providers";

describe("detectProviderFromKey", () => {
  it("detects Anthropic from sk-ant-", () => {
    expect(detectProviderFromKey("sk-ant-api03-xyz")).toBe("anthropic");
  });

  it("detects OpenAI from sk- and sk-proj-", () => {
    expect(detectProviderFromKey("sk-proj-abc")).toBe("openai");
    expect(detectProviderFromKey("sk-abc123")).toBe("openai");
  });

  it("detects xAI from xai-", () => {
    expect(detectProviderFromKey("xai-abc123")).toBe("xai");
  });

  it("detects other providers by prefix", () => {
    expect(detectProviderFromKey("gsk_abc")).toBe("groq");
    expect(detectProviderFromKey("sk-or-v1-abc")).toBe("openrouter");
    expect(detectProviderFromKey("nvapi-abc")).toBe("nvidia");
    expect(detectProviderFromKey("pplx-abc")).toBe("perplexity");
    expect(detectProviderFromKey("fw_abc")).toBe("fireworks");
    expect(detectProviderFromKey("csk-abc")).toBe("cerebras");
    expect(detectProviderFromKey("AIzaSyABC")).toBe("google");
  });

  it("returns null for empty or unknown formats", () => {
    expect(detectProviderFromKey("")).toBeNull();
    expect(detectProviderFromKey("   ")).toBeNull();
    expect(detectProviderFromKey("hello-world")).toBeNull();
  });
});

describe("getProvider", () => {
  it("returns the matching provider", () => {
    expect(getProvider("anthropic").id).toBe("anthropic");
  });

  it("falls back to the first provider for unknown ids", () => {
    expect(getProvider("does-not-exist").id).toBe(PROVIDERS[0].id);
  });
});

describe("effectiveProvider", () => {
  it("returns the default when no override is set", () => {
    expect(effectiveProvider({ providerId: "openai", baseUrlOverride: "" }).baseUrl).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("applies an override and strips trailing slashes", () => {
    expect(
      effectiveProvider({ providerId: "openai", baseUrlOverride: "http://localhost:11434/v1/" }).baseUrl
    ).toBe("http://localhost:11434/v1");
  });

  it("keeps the provider kind", () => {
    expect(
      effectiveProvider({ providerId: "anthropic", baseUrlOverride: "http://x/v1" }).kind
    ).toBe("anthropic");
  });
});

describe("provider registry", () => {
  it("has unique ids and complete fields", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PROVIDERS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.baseUrl.startsWith("http")).toBe(true);
      expect(["openai", "anthropic"]).toContain(p.kind);
      expect(typeof p.requiresKey).toBe("boolean");
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it("ships Sarvam as the default with a matching model", () => {
    const sarvam = PROVIDERS[0];
    expect(sarvam.id).toBe("sarvam");
    expect(sarvam.baseUrl).toBe("https://api.sarvam.ai/v2");
    expect(sarvam.models.some((m) => m.id === sarvam.defaultModel)).toBe(true);
  });

  it("marks local endpoints as key-free", () => {
    expect(getProvider("ollama").requiresKey).toBe(false);
    expect(getProvider("lmstudio").requiresKey).toBe(false);
    expect(getProvider("sarvam").requiresKey).toBe(true);
  });
});
