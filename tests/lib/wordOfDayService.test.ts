import { describe, it, expect, vi } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createDetailCache } from "../../src/lib/cache";
import { createTodayWordStore, createLastShownStore } from "../../src/lib/dailyWord";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import { ensureTodayWord, shouldInjectWidget, markWidgetShown } from "../../src/lib/wordOfDayService";
import type { ModelClient } from "../../src/lib/modelClient";

function makeDeps(today: string) {
  const wordStore = createWordStore(createFakeStorageArea());
  const detailCache = createDetailCache(createFakeStorageArea());
  const todayWordStore = createTodayWordStore(createFakeStorageArea());
  const lastShownStore = createLastShownStore(createFakeStorageArea());
  const model: ModelClient = {
    pickWordOfDay: vi.fn().mockResolvedValue("lucid"),
    explainWord: vi.fn().mockResolvedValue({
      meaning: "clear-headed",
      example: "A lucid explanation.",
      pronunciation: "/ˈluːsɪd/",
      partOfSpeech: "adjective",
      topic: "Everyday",
    }),
  };
  return {
    model,
    wordStore,
    detailCache,
    todayWordStore,
    lastShownStore,
    today: () => today,
  };
}

describe("ensureTodayWord", () => {
  it("picks and saves a new word the first time it's called that day", async () => {
    const deps = makeDeps("2026-09-19");
    const result = await ensureTodayWord(deps);
    expect(result).toEqual({ date: "2026-09-19", word: "lucid" });
    expect(deps.model.pickWordOfDay).toHaveBeenCalledOnce();
    expect((await deps.wordStore.getAllWords())[0].source).toBe("daily");
  });

  it("does not call the model again the same day", async () => {
    const deps = makeDeps("2026-09-19");
    await ensureTodayWord(deps);
    await ensureTodayWord(deps);
    expect(deps.model.pickWordOfDay).toHaveBeenCalledOnce();
  });

  it("excludes only previously shown daily words from the prompt history", async () => {
    const deps = makeDeps("2026-09-19");
    await deps.wordStore.saveWord({
      word: "ephemeral",
      shortMeaning: "m",
      savedDate: "2026-09-18",
      source: "daily",
      quizStats: { seen: 0, known: 0 },
    });
    await deps.wordStore.saveWord({
      word: "manual-word",
      shortMeaning: "m",
      savedDate: "2026-09-18",
      source: "manual",
      quizStats: { seen: 0, known: 0 },
    });
    await ensureTodayWord(deps);
    expect(deps.model.pickWordOfDay).toHaveBeenCalledWith(["ephemeral"]);
  });
});

describe("shouldInjectWidget / markWidgetShown", () => {
  it("shows the first time, then not again the same day, then again the next day", async () => {
    const deps = makeDeps("2026-09-19");
    expect(await shouldInjectWidget(deps)).toBe(true);
    await markWidgetShown(deps);
    expect(await shouldInjectWidget(deps)).toBe(false);

    const nextDayDeps = { ...deps, today: () => "2026-09-20" };
    expect(await shouldInjectWidget(nextDayDeps)).toBe(true);
  });
});
