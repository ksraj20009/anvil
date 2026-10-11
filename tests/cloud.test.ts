import { describe, it, expect } from "vitest";
import { makeSlug, buildWorkspacePayload, normalizeWorkspaceRow } from "../src/lib/cloud";

describe("makeSlug", () => {
  it("is prefixed and unique", () => {
    const a = makeSlug();
    expect(a.startsWith("anvil-")).toBe(true);
    expect(a.length).toBeGreaterThan(10);
    expect(a).not.toBe(makeSlug());
  });
});

describe("buildWorkspacePayload", () => {
  const files = [{ path: "a.js", content: "x" }];
  const sessions: never[] = [];

  it("defaults an empty name", () => {
    expect(buildWorkspacePayload("", files, sessions).name).toBe("My workspace");
    expect(buildWorkspacePayload("   ", files, sessions).name).toBe("My workspace");
  });

  it("keeps a real name and passes files/sessions through", () => {
    const p = buildWorkspacePayload("Proj", files, sessions);
    expect(p.name).toBe("Proj");
    expect(p.files).toEqual(files);
  });
});

describe("normalizeWorkspaceRow", () => {
  it("keeps valid files and drops junk", () => {
    const ws = normalizeWorkspaceRow({
      id: "abc",
      name: "n",
      updated_at: "2026-01-01",
      files: [{ path: "a.js", content: "x" }, { path: 5 }, null, "junk"],
      sessions: [{ id: "s1" }],
    });
    expect(ws.id).toBe("abc");
    expect(ws.files).toEqual([{ path: "a.js", content: "x" }]);
    expect(ws.sessions).toHaveLength(1);
  });

  it("handles null input", () => {
    const ws = normalizeWorkspaceRow(null);
    expect(ws.files).toEqual([]);
    expect(ws.name).toBe("Workspace");
  });
});
