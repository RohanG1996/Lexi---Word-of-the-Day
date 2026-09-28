import { describe, it, expect, vi } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createDetailCache } from "../../src/lib/cache";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import { addWord } from "../../src/lib/addWord";
import type { ModelClient } from "../../src/lib/modelClient";

function makeDeps() {
  const wordStore = createWordStore(createFakeStorageArea());
  const detailCache = createDetailCache(createFakeStorageArea());
  const model: ModelClient = {
    pickWordOfDay: vi.fn(),
    explainWord: vi.fn().mockResolvedValue({
      meaning: "lasting a short time",
      example: "It was ephemeral.",
      pronunciation: "/əˈfem(ə)rəl/",
      partOfSpeech: "adjective",
      topic: "Everyday",
    }),
  };
  return { model, wordStore, detailCache, today: () => "2026-09-19" };
}

describe("addWord", () => {
  it("throws on an empty word", async () => {
    await expect(addWord(makeDeps(), "   ")).rejects.toThrow();
  });

  it("explains and saves a new word", async () => {
    const deps = makeDeps();
    const record = await addWord(deps, "ephemeral");
    expect(record.shortMeaning).toBe("lasting a short time");
    expect(record.source).toBe("manual");
    expect(record.topic).toBe("Everyday");
    expect(deps.model.explainWord).toHaveBeenCalledWith("ephemeral");
  });

  it("returns the existing record for a duplicate without calling the model again", async () => {
    const deps = makeDeps();
    await addWord(deps, "ephemeral");
    await addWord(deps, "Ephemeral");
    expect(deps.model.explainWord).toHaveBeenCalledOnce();
    expect(await deps.wordStore.getAllWords()).toHaveLength(1);
  });
});
