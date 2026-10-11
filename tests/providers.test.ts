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
