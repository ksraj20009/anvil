import { describe, it, expect } from "vitest";
import { diffStat } from "../src/lib/diff";

describe("diffStat", () => {
  it("counts a brand-new file as all additions", () => {
    expect(diffStat("", "a\nb\nc")).toEqual({ added: 3, removed: 0 });
  });

  it("counts a fully removed file", () => {
    expect(diffStat("a\nb", "")).toEqual({ added: 0, removed: 2 });
  });

  it("counts a one-line replacement", () => {
    expect(diffStat("a\nb", "a\nc")).toEqual({ added: 1, removed: 1 });
  });

  it("reports no change for identical input", () => {
    expect(diffStat("x\ny", "x\ny")).toEqual({ added: 0, removed: 0 });
  });
});
