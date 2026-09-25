import { describe, it, expect } from "vitest";
import { pickNextQuizWord } from "../../src/sidepanel/quiz";
import type { CompactWordRecord } from "../../src/lib/types";

function word(w: string, seen: number, known: number): CompactWordRecord {
  return { word: w, shortMeaning: "m", savedDate: "2026-09-19", source: "manual", quizStats: { seen, known } };
}

describe("pickNextQuizWord", () => {
  it("returns null for an empty list", () => {
    expect(pickNextQuizWord([])).toBeNull();
  });

  it("prioritizes a never-seen word over one already known", () => {
    const words = [word("mastered", 5, 5), word("new", 0, 0)];
    expect(pickNextQuizWord(words)?.word).toBe("new");
  });

  it("prioritizes a word with a lower known ratio", () => {
    const words = [word("shaky", 4, 1), word("solid", 4, 4)];
    expect(pickNextQuizWord(words)?.word).toBe("shaky");
  });
});
