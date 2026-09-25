import type { ModelClient } from "./modelClient";
import type { CompactWordRecord, FullWordDetail } from "./types";

export interface AddWordDeps {
  model: ModelClient;
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    saveWord(r: CompactWordRecord): Promise<CompactWordRecord>;
  };
  detailCache: {
    setDetail(d: FullWordDetail): Promise<void>;
  };
  today: () => string;
}

export async function addWord(deps: AddWordDeps, rawWord: string): Promise<CompactWordRecord> {
  const word = rawWord.trim();
  if (!word) throw new Error("Empty word");

  const existing = (await deps.wordStore.getAllWords()).find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
  if (existing) return existing;

  const explanation = await deps.model.explainWord(word);
  const record: CompactWordRecord = {
    word,
    shortMeaning: explanation.meaning,
    savedDate: deps.today(),
    source: "manual",
    quizStats: { seen: 0, known: 0 },
  };
  await deps.wordStore.saveWord(record);
  await deps.detailCache.setDetail({
    word,
    meaning: explanation.meaning,
    example: explanation.example,
    pronunciation: explanation.pronunciation,
    partOfSpeech: explanation.partOfSpeech,
    cachedAt: deps.today(),
  });
  return record;
}
