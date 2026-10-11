import { describe, it, expect } from "vitest";
import { dataUrlToParts, formatBytes, isAcceptedImage } from "../src/lib/vision";

describe("dataUrlToParts", () => {
  it("splits mime type and payload", () => {
    expect(dataUrlToParts("data:image/png;base64,AAAA")).toEqual({
      mime: "image/png",
      data: "AAAA",
    });
  });

  it("throws on a non-data URL", () => {
    expect(() => dataUrlToParts("https://example.com/x.png")).toThrow();
  });
});

describe("formatBytes", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("isAcceptedImage", () => {
  it("accepts supported image types only", () => {
    expect(isAcceptedImage({ type: "image/png" } as File)).toBe(true);
    expect(isAcceptedImage({ type: "image/jpeg" } as File)).toBe(true);
    expect(isAcceptedImage({ type: "text/plain" } as File)).toBe(false);
  });
});
