import { describe, it, expect } from "vitest";
import { recategoriseWords } from "../../src/lib/recategorise";
import type { CompactWordRecord } from "../../src/lib/types";

const rec = (word: string, topic?: string): CompactWordRecord => ({
  word, shortMeaning: "", savedDate: "2026-09-30", source: "manual", quizStats: { seen: 0, known: 0 }, topic,
});

function setup(words: CompactWordRecord[], answers: Record<string, string | Error>) {
  const store: Record<string, unknown> = {};
  const flagArea = {
    get: async (k: string | string[] | null) => ({ [k as string]: store[k as string] }),
    set: async (items: Record<string, unknown>) => void Object.assign(store, items),
    remove: async () => {},
  };
  let saved: Record<string, string> = {};
  const calls: string[] = [];
  const deps = {
    model: {
      explainWord: async (w: string) => {
        calls.push(w);
        const a = answers[w];
        if (a instanceof Error) throw a;
        return { meaning: "", example: "", pronunciation: "", partOfSpeech: "", topic: a ?? "Everyday" };
      },
    },
    wordStore: { getAllWords: async () => words, setTopics: async (t: Record<string, string>) => void (saved = t) },
    flagArea,
  };
  return { deps, store, calls, saved: () => saved };
}

describe("recategoriseWords", () => {
  it("re-asks only Everyday / topic-less words and updates the ones that change", async () => {
    const t = setup([rec("design-system", "Everyday"), rec("latency", "Technology"), rec("old"), rec("lucid", "Everyday")], {
      "design-system": "Design", old: "Everyday", lucid: "Everyday",
    });
    expect(await recategoriseWords(t.deps)).toBe(2);
    expect(t.calls).toEqual(["design-system", "old", "lucid"]);
    expect(t.saved()).toEqual({ "design-system": "Design", old: "Everyday" });
    expect(t.store["lexi.topicsRecategorised"]).toBe(true);
  });

  it("runs once per device", async () => {
    const t = setup([rec("a", "Everyday")], { a: "Design" });
    await recategoriseWords(t.deps);
    t.calls.length = 0;
    expect(await recategoriseWords(t.deps)).toBe(0);
    expect(t.calls).toEqual([]);
  });

  it("keeps going after a failed call and retries next time", async () => {
    const t = setup([rec("a", "Everyday"), rec("b", "Everyday")], { a: new Error("offline"), b: "Law" });
    expect(await recategoriseWords(t.deps)).toBe(1);
    expect(t.saved()).toEqual({ b: "Law" });
    expect(t.store["lexi.topicsRecategorised"]).toBeUndefined();
  });
});
