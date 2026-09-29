import { describe, it, expect } from "vitest";
import { logoMarkSvg } from "../../src/lib/logo";

describe("logoMarkSvg", () => {
  it("renders at the requested size with an accessible name", () => {
    const svg = logoMarkSvg(36);
    expect(svg).toContain('width="36" height="36"');
    expect(svg).toContain('aria-label="Lexi"');
  });

  it("gives each mark its own filter id so several can share a page", () => {
    const ids = [logoMarkSvg(18), logoMarkSvg(18)].map((s) => /id="(lexi-rough-\d+)"/.exec(s)![1]);
    expect(ids[0]).not.toBe(ids[1]);
    const svg = logoMarkSvg(18);
    const id = /id="(lexi-rough-\d+)"/.exec(svg)![1];
    expect(svg).toContain(`filter="url(#${id})"`);
  });

  it("parses as valid SVG with no script", () => {
    const doc = new DOMParser().parseFromString(logoMarkSvg(30), "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();
  });
});
