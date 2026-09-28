import { describe, it, expect } from "vitest";
import { countWords, isLookupCandidate } from "../../src/content/selectionRules";

describe("countWords", () => {
  it("counts whitespace-separated words, ignoring surrounding and repeated whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("serendipity")).toBe(1);
    expect(countWords("  design   system \n")).toBe(2);
    expect(countWords("assess your design system")).toBe(4);
  });
});

describe("isLookupCandidate", () => {
  it("accepts one word", () => {
    expect(isLookupCandidate("serendipity")).toBe(true);
  });

  it("accepts two words, including across a line break", () => {
    expect(isLookupCandidate("design system")).toBe(true);
    expect(isLookupCandidate("design\nsystem")).toBe(true);
  });

  it("treats hyphenated and apostrophe words as one word", () => {
    expect(isLookupCandidate("well-known")).toBe(true);
    expect(isLookupCandidate("system's")).toBe(true);
  });

  it("rejects three or more words so copying a phrase or sentence never shows the popover", () => {
    expect(isLookupCandidate("assess your design")).toBe(false);
    expect(isLookupCandidate("assess your design system's health and identify")).toBe(false);
  });

  it("still rejects empty, single-character and over-long selections", () => {
    expect(isLookupCandidate("")).toBe(false);
    expect(isLookupCandidate("   ")).toBe(false);
    expect(isLookupCandidate("a")).toBe(false);
    expect(isLookupCandidate("x".repeat(61))).toBe(false);
  });
});
