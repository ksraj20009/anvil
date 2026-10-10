import { describe, it, expect } from "vitest";
import {
  serializeProject,
  parseProject,
  serializeChat,
  parseChat,
} from "../src/lib/project";
import type { ChatMessage, TranscriptItem } from "../src/types";

describe("project serialization", () => {
  const files = [
    { path: "a.js", content: "x" },
    { path: "b/c.md", content: "# hi" },
  ];

  it("round-trips files", () => {
    expect(parseProject(serializeProject(files))).toEqual(files);
  });

  it("rejects non-JSON input", () => {
    expect(() => parseProject("definitely not json")).toThrow(/valid JSON/i);
  });

  it("rejects a payload with no files array", () => {
    expect(() => parseProject(JSON.stringify({ hello: 1 }))).toThrow(/files/i);
  });

  it("keeps valid entries and drops malformed ones", () => {
    const text = JSON.stringify({
      files: [{ path: "a", content: "x" }, { path: 5 }, null, "junk"],
    });
    expect(parseProject(text)).toEqual([{ path: "a", content: "x" }]);
  });

  it("throws when nothing valid survives", () => {
    expect(() => parseProject(JSON.stringify({ files: [{ nope: 1 }] }))).toThrow(/no valid files/i);
  });
});

describe("chat serialization", () => {
  const history: ChatMessage[] = [
    { role: "system", content: "s" },
    { role: "user", content: "hi" },
  ];
  const items: TranscriptItem[] = [
    { kind: "user", text: "hi" },
    { kind: "tool", name: "read_file", args: "{}", result: "x" },
  ];

  it("round-trips chat state", () => {
    expect(parseChat(serializeChat({ history, items }))).toEqual({ history, items });
  });

  it("returns null for empty or missing input", () => {
    expect(parseChat(null)).toBeNull();
    expect(parseChat("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseChat("not json")).toBeNull();
    expect(parseChat(JSON.stringify({ history: [] }))).toBeNull();
  });

  it("filters out invalid messages", () => {
    const text = JSON.stringify({
      history: [{ role: "user", content: "ok" }, { role: 5 }, null],
      items: [],
    });
    expect(parseChat(text)).toEqual({ history: [{ role: "user", content: "ok" }], items: [] });
  });
});
