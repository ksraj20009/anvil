import { describe, it, expect } from "vitest";
import { newSession, titleFor, parseSessions, serializeSessions } from "../src/lib/sessions";

describe("titleFor", () => {
  it("uses the first user message", () => {
    expect(titleFor([{ kind: "user", text: "Build me a todo app please" }])).toBe(
      "Build me a todo app please"
    );
  });

  it("truncates long titles", () => {
    const long = "x".repeat(60);
    const title = titleFor([{ kind: "user", text: long }]);
    expect(title.length).toBeLessThanOrEqual(43);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back to a default", () => {
    expect(titleFor([])).toBe("New chat");
    expect(titleFor([{ kind: "assistant", text: "hi" }])).toBe("New chat");
  });
});

describe("sessions serialization", () => {
  it("round-trips", () => {
    const s = newSession("sys", "id1");
    const parsed = parseSessions(serializeSessions({ activeId: "id1", sessions: [s] }))!;
    expect(parsed.activeId).toBe("id1");
    expect(parsed.sessions[0].id).toBe("id1");
    expect(parsed.sessions[0].history[0]).toEqual({ role: "system", content: "sys" });
  });

  it("returns null for missing or empty state", () => {
    expect(parseSessions(null)).toBeNull();
    expect(parseSessions("{}")).toBeNull();
    expect(parseSessions(JSON.stringify({ sessions: [] }))).toBeNull();
  });

  it("repairs an unknown activeId", () => {
    const s = newSession("sys", "id1");
    const parsed = parseSessions(JSON.stringify({ activeId: "nope", sessions: [s] }))!;
    expect(parsed.activeId).toBe("id1");
  });
});
