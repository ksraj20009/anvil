import { describe, it, expect } from "vitest";
import { isTextPath, selectRepoFiles, parseRepos, decodeBase64 } from "../src/lib/github";

describe("isTextPath", () => {
  it("keeps source files", () => {
    expect(isTextPath("src/app.ts")).toBe(true);
    expect(isTextPath("README.md")).toBe(true);
    expect(isTextPath("Makefile")).toBe(true);
  });

  it("rejects binaries", () => {
    expect(isTextPath("logo.png")).toBe(false);
    expect(isTextPath("app.wasm")).toBe(false);
    expect(isTextPath("font.woff2")).toBe(false);
  });

  it("skips vendored directories", () => {
    expect(isTextPath("node_modules/x/index.js")).toBe(false);
    expect(isTextPath("dist/bundle.js")).toBe(false);
    expect(isTextPath(".git/config")).toBe(false);
  });
});

describe("selectRepoFiles", () => {
  it("keeps text blobs and respects the limit", () => {
    const tree = [
      { path: "a.ts", type: "blob" },
      { path: "b.png", type: "blob" },
      { path: "src", type: "tree" },
      { path: "node_modules/x.js", type: "blob" },
      { path: "c.py", type: "blob" },
    ];
    expect(selectRepoFiles(tree)).toEqual(["a.ts", "c.py"]);
    expect(selectRepoFiles(tree, 1)).toEqual(["a.ts"]);
  });
});

describe("parseRepos", () => {
  it("maps fields and applies defaults", () => {
    const out = parseRepos([
      {
        full_name: "me/x",
        default_branch: "main",
        private: true,
        description: "hi",
        updated_at: "2024-01-01",
      },
      { full_name: "me/y" },
      { nope: 1 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      fullName: "me/x",
      defaultBranch: "main",
      isPrivate: true,
      description: "hi",
      updatedAt: "2024-01-01",
    });
    expect(out[1].defaultBranch).toBe("main");
  });

  it("handles junk input", () => {
    expect(parseRepos(null)).toEqual([]);
  });
});

describe("decodeBase64", () => {
  it("decodes UTF-8 content", () => {
    const b64 = Buffer.from("héllo", "utf8").toString("base64");
    expect(decodeBase64(b64)).toBe("héllo");
  });

  it("ignores embedded newlines", () => {
    const b64 = Buffer.from("abc", "utf8").toString("base64");
    expect(decodeBase64(`${b64.slice(0, 2)}\n${b64.slice(2)}`)).toBe("abc");
  });
});
