import { describe, it, expect } from "vitest";
import { filterWords, topicOf, topicChips, searchWords, ALL_TOPICS } from "../../src/sidepanel/search";
import type { CompactWordRecord } from "../../src/lib/types";

const base = { savedDate: "2026-09-18", source: "manual" as const, quizStats: { seen: 0, known: 0 } };
const words: CompactWordRecord[] = [
  { ...base, word: "ephemeral", shortMeaning: "lasting a short time", topic: "Everyday" },
  { ...base, word: "lucid", shortMeaning: "clear and easy to understand", topic: "Everyday" },
  { ...base, word: "latency", shortMeaning: "the delay before a transfer begins", topic: "Technology" },
  { ...base, word: "affordance", shortMeaning: "a clue about how something can be used", topic: "Design" },
  { ...base, word: "old word", shortMeaning: "saved before topics existed" },
];

describe("filterWords", () => {
  it("returns everything for an empty query", () => {
    expect(filterWords(words, "")).toHaveLength(words.length);
  });

  it("matches by the word itself", () => {
    expect(filterWords(words, "luc").map((w) => w.word)).toEqual(["lucid"]);
  });

  it("matches by meaning, even when the word itself doesn't match", () => {
    expect(filterWords(words, "short time").map((w) => w.word)).toEqual(["ephemeral"]);
  });

  it("matches by topic name", () => {
    expect(filterWords(words, "technology").map((w) => w.word)).toEqual(["latency"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterWords(words, "xyz")).toHaveLength(0);
  });
});

describe("topicOf", () => {
  it("uses the stored topic and falls back to Other for older words", () => {
    expect(topicOf(words[2])).toBe("Technology");
    expect(topicOf(words[4])).toBe("Other");
  });
});

describe("topicChips", () => {
  it("lists each present topic with its count, biggest first, and puts Other last", () => {
    expect(topicChips(words)).toEqual([
      { topic: "Everyday", count: 2 },
      { topic: "Design", count: 1 },
      { topic: "Technology", count: 1 },
      { topic: "Other", count: 1 },
    ]);
  });

  it("is empty when there are no words", () => {
    expect(topicChips([])).toEqual([]);
  });
});

describe("searchWords", () => {
  it("returns every word for All with no query", () => {
    expect(searchWords(words, "", ALL_TOPICS)).toHaveLength(words.length);
  });

  it("narrows to the selected topic", () => {
    expect(searchWords(words, "", "Everyday").map((w) => w.word)).toEqual(["ephemeral", "lucid"]);
  });

  it("applies the query inside the selected topic", () => {
    expect(searchWords(words, "lat", "Technology").map((w) => w.word)).toEqual(["latency"]);
    expect(searchWords(words, "lat", "Design")).toHaveLength(0);
  });

  it("searches across all topics when All is selected", () => {
    expect(searchWords(words, "lat", ALL_TOPICS).map((w) => w.word)).toEqual(["latency"]);
  });
});
