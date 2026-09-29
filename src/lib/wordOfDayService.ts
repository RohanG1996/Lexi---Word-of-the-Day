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
    getDetail(word: string): Promise<FullWordDetail | undefined>;
    setDetail(d: FullWordDetail): Promise<void>;
  };
  today: () => string;
}

// Picks and caches today's word, but does NOT add it to the library - it's only a candidate until the user
// actually saves it (from the widget's "Add to my library" button or the side panel's today's-word banner via
// saveTodayWord() below). This means a word shown but never saved won't count toward the "previously shown daily
// words" exclusion below either - an accepted trade-off so the exclusion list matches what saveTodayWord below
// actually writes, rather than tracking shown-but-unsaved words separately.
export async function ensureTodayWord(deps: WordOfDayDeps): Promise<TodayWordRecord> {
  const today = deps.today();
  const existing = await deps.todayWordStore.getTodayWord();
  if (existing && existing.date === today) return existing;

  const history = (await deps.wordStore.getAllWords())
    .filter((w) => w.source === "daily")
    .map((w) => w.word);

  const word = await deps.model.pickWordOfDay(history);
  const explanation = await deps.model.explainWord(word);

  await deps.detailCache.setDetail({
    word,
    meaning: explanation.meaning,
    example: explanation.example,
    pronunciation: explanation.pronunciation,
    partOfSpeech: explanation.partOfSpeech,
    cachedAt: today,
  });

  const record = { date: today, word, topic: explanation.topic };
  await deps.todayWordStore.setTodayWord(record);
  return record;
}

// Actually saves today's word to the library - called from the widget's "Add to my library" button and the side
// panel's today's-word banner, both idempotent (wordStore.saveWord no-ops if it's already saved). Needs no model
// call: everything it writes was already cached by ensureTodayWord.
export async function saveTodayWord(
  deps: Pick<WordOfDayDeps, "todayWordStore" | "wordStore" | "detailCache" | "today">
): Promise<CompactWordRecord> {
  const record = await deps.todayWordStore.getTodayWord();
  if (!record) throw new Error("There's no word of the day yet.");
  const detail = await deps.detailCache.getDetail(record.word);
  if (!detail) throw new Error("Still loading today's word - try again in a moment.");
  return deps.wordStore.saveWord({
    word: record.word,
    shortMeaning: detail.meaning,
    savedDate: deps.today(),
    source: "daily",
    quizStats: { seen: 0, known: 0 },
    topic: record.topic,
  });
}

export async function shouldInjectWidget(deps: Pick<WordOfDayDeps, "lastShownStore" | "today">): Promise<boolean> {
  return shouldShowWidgetToday(await deps.lastShownStore.getLastShownDate(), deps.today());
}

export async function markWidgetShown(deps: Pick<WordOfDayDeps, "lastShownStore" | "today">): Promise<void> {
  await deps.lastShownStore.setLastShownDate(deps.today());
}
