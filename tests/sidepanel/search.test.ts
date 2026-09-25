import { describe, it, expect } from "vitest";
import { filterWords } from "../../src/sidepanel/search";
import type { CompactWordRecord } from "../../src/lib/types";

const words: CompactWordRecord[] = [
  { word: "ephemeral", shortMeaning: "lasting a short time", savedDate: "2026-09-18", source: "daily", quizStats: { seen: 0, known: 0 } },
  { word: "lucid", shortMeaning: "clear and easy to understand", savedDate: "2026-09-19", source: "manual", quizStats: { seen: 0, known: 0 } },
];

describe("filterWords", () => {
  it("returns everything for an empty query", () => {
    expect(filterWords(words, "")).toHaveLength(2);
  });

  it("matches by the word itself", () => {
    expect(filterWords(words, "luc").map((w) => w.word)).toEqual(["lucid"]);
  });

  it("matches by meaning, even when the word itself doesn't match", () => {
    expect(filterWords(words, "short time").map((w) => w.word)).toEqual(["ephemeral"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterWords(words, "xyz")).toHaveLength(0);
  });
});
