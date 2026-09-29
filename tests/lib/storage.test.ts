import { describe, it, expect } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import type { CompactWordRecord } from "../../src/lib/types";

function makeRecord(word: string): CompactWordRecord {
  return {
    word,
    shortMeaning: "a test meaning",
    savedDate: "2026-09-19",
    source: "manual",
    quizStats: { seen: 0, known: 0 },
  };
}

describe("createWordStore", () => {
  it("saves and retrieves a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    const words = await store.getAllWords();
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("ephemeral");
  });

  it("does not create a duplicate for the same word, case-insensitive", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("Ephemeral"));
    await store.saveWord(makeRecord("ephemeral"));
    expect(await store.getAllWords()).toHaveLength(1);
  });

  it("deletes a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    await store.deleteWord("ephemeral");
    expect(await store.getAllWords()).toHaveLength(0);
  });

  it("deletes several words at once, case-insensitive, leaving the rest", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    await store.saveWord(makeRecord("Lucid"));
    await store.saveWord(makeRecord("latency"));
    await store.deleteWords(["Ephemeral", "latency"]);
    const words = await store.getAllWords();
    expect(words.map((w) => w.word)).toEqual(["Lucid"]);
  });

  it("updates quiz stats for a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    await store.updateQuizStats("ephemeral", true);
    const words = await store.getAllWords();
    expect(words[0].quizStats).toEqual({ seen: 1, known: 1 });
  });
});
