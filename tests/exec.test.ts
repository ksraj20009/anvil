import { describe, it, expect } from "vitest";
import { languageOf } from "../src/lib/exec";

describe("languageOf", () => {
  it("maps JavaScript extensions", () => {
    expect(languageOf("a.js")).toBe("javascript");
    expect(languageOf("src/b.mjs")).toBe("javascript");
    expect(languageOf("c.jsx")).toBe("javascript");
  });

  it("maps Python extensions", () => {
    expect(languageOf("main.py")).toBe("python");
  });

  it("returns unknown for everything else", () => {
    expect(languageOf("README.md")).toBe("unknown");
    expect(languageOf("noext")).toBe("unknown");
  });
});
