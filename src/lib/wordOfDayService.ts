import type { ModelClient } from "./modelClient";
import type { CompactWordRecord, FullWordDetail } from "./types";
import type { TodayWordRecord } from "./dailyWord";
import { shouldShowWidgetToday } from "./trigger";

export interface WordOfDayDeps {
  model: ModelClient;
  todayWordStore: {
    getTodayWord(): Promise<TodayWordRecord | null>;
    setTodayWord(r: TodayWordRecord): Promise<void>;
  };
  lastShownStore: {
    getLastShownDate(): Promise<string | null>;
    setLastShownDate(date: string): Promise<void>;
  };
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    saveWord(r: CompactWordRecord): Promise<CompactWordRecord>;
  };
  detailCache: {
    setDetail(d: FullWordDetail): Promise<void>;
  };
  today: () => string;
}

export async function ensureTodayWord(deps: WordOfDayDeps): Promise<TodayWordRecord> {
  const today = deps.today();
  const existing = await deps.todayWordStore.getTodayWord();
  if (existing && existing.date === today) return existing;

  const history = (await deps.wordStore.getAllWords())
    .filter((w) => w.source === "daily")
    .map((w) => w.word);

  const word = await deps.model.pickWordOfDay(history);
  const explanation = await deps.model.explainWord(word);

  await deps.wordStore.saveWord({
    word,
    shortMeaning: explanation.meaning,
    savedDate: today,
    source: "daily",
    quizStats: { seen: 0, known: 0 },
  });
  await deps.detailCache.setDetail({
    word,
    meaning: explanation.meaning,
    example: explanation.example,
    pronunciation: explanation.pronunciation,
    partOfSpeech: explanation.partOfSpeech,
    cachedAt: today,
  });

  const record = { date: today, word };
  await deps.todayWordStore.setTodayWord(record);
  return record;
}

export async function shouldInjectWidget(deps: Pick<WordOfDayDeps, "lastShownStore" | "today">): Promise<boolean> {
  return shouldShowWidgetToday(await deps.lastShownStore.getLastShownDate(), deps.today());
}

export async function markWidgetShown(deps: Pick<WordOfDayDeps, "lastShownStore" | "today">): Promise<void> {
  await deps.lastShownStore.setLastShownDate(deps.today());
}
