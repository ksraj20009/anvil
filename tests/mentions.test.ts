import { describe, it, expect } from "vitest";
import { extractMentions, validMentions, expandMentions, suggestMentions } from "../src/lib/mentions";

describe("extractMentions", () => {
  it("pulls @paths from text", () => {
    expect(extractMentions("look at @src/app.ts and @README.md")).toEqual([
      "src/app.ts",
      "README.md",
    ]);
  });

  it("de-duplicates", () => {
    expect(extractMentions("@a @a @b")).toEqual(["a", "b"]);
  });

  it("does not treat an email as a mention", () => {
    expect(extractMentions("mail me at bob@example.com")).toEqual([]);
  });
});

describe("validMentions", () => {
  it("keeps only existing files", () => {
    expect(validMentions("@a.js @missing.js", ["a.js"])).toEqual(["a.js"]);
  });
});

describe("expandMentions", () => {
  it("appends referenced file contents", () => {
    const out = expandMentions("explain @a.js", { "a.js": "console.log(1)" });
    expect(out).toContain('<file path="a.js">');
    expect(out).toContain("console.log(1)");
    expect(out.startsWith("explain @a.js")).toBe(true);
  });

  it("leaves text untouched when nothing matches", () => {
    expect(expandMentions("just text", { "a.js": "x" })).toBe("just text");
  });
});

describe("suggestMentions", () => {
  const files = ["src/app.ts", "src/lib/vfs.ts", "README.md", "index.html"];

  it("filters by substring and ranks earlier matches first", () => {
    const out = suggestMentions("app", files);
    expect(out[0]).toBe("src/app.ts");
  });

  it("respects the limit", () => {
    expect(suggestMentions("", files, 2)).toHaveLength(2);
  });
});
