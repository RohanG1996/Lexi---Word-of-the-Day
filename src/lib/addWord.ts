import type { ClaudeClient } from "./claudeClient";
import type { CompactWordRecord } from "./types";

export interface AddWordDeps {
  claude: ClaudeClient;
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    saveWord(r: CompactWordRecord): Promise<CompactWordRecord>;
  };
  detailCache: {
    setDetail(d: { word: string; meaning: string; example: string; cachedAt: string }): Promise<void>;
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

  const explanation = await deps.claude.explainWord(word);
  const record: CompactWordRecord = {
    word,
    shortMeaning: explanation.meaning,
    savedDate: deps.today(),
    source: "manual",
    quizStats: { seen: 0, known: 0 },
  };
  await deps.wordStore.saveWord(record);
  await deps.detailCache.setDetail({ word, meaning: explanation.meaning, example: explanation.example, cachedAt: deps.today() });
  return record;
}
