import { describe, it, expect } from "vitest";
import { customProviders, slugifyId, customToConfig } from "../src/lib/customProviders";

describe("slugifyId", () => {
  it("makes a stable id from a label", () => {
    expect(slugifyId("My Company")).toBe("custom:my-company");
    expect(slugifyId("  Foo!! Bar  ")).toBe("custom:foo-bar");
  });
});

describe("custom provider registry", () => {
  it("adds, resolves and removes", () => {
    const item = customProviders.add({
      label: "Test Co",
      baseUrl: "https://api.test.co/v1",
      kind: "openai",
      defaultModel: "m1",
    });
    expect(customProviders.get(item.id)?.label).toBe("Test Co");
    expect(customProviders.list().some((c) => c.id === item.id)).toBe(true);
    customProviders.remove(item.id);
    expect(customProviders.get(item.id)).toBeUndefined();
  });

  it("replaces an entry with the same id", () => {
    customProviders.add({ label: "Dup", baseUrl: "https://a/v1", kind: "openai", defaultModel: "m" });
    customProviders.add({ label: "Dup", baseUrl: "https://b/v1", kind: "openai", defaultModel: "m2" });
    const matches = customProviders.list().filter((c) => c.id === "custom:dup");
    expect(matches).toHaveLength(1);
    expect(matches[0].baseUrl).toBe("https://b/v1");
    customProviders.remove("custom:dup");
  });
});

describe("customToConfig", () => {
  it("produces a usable ProviderConfig", () => {
    const cfg = customToConfig({
      id: "custom:x",
      label: "X",
      kind: "anthropic",
      baseUrl: "https://x/v1",
      defaultModel: "m",
    });
    expect(cfg.kind).toBe("anthropic");
    expect(cfg.isCustom).toBe(true);
    expect(cfg.requiresKey).toBe(true);
    expect(cfg.models[0].id).toBe("m");
  });
});
