import type { CompactWordRecord } from "./types";

const KEY = "lexi.words";

export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export function createWordStore(area: StorageArea) {
  async function getAllWords(): Promise<CompactWordRecord[]> {
    const data = await area.get(KEY);
    return (data[KEY] as CompactWordRecord[]) ?? [];
  }

  async function saveWord(record: CompactWordRecord): Promise<CompactWordRecord> {
    const words = await getAllWords();
    const existing = words.find((w) => w.word.toLowerCase() === record.word.toLowerCase());
    if (existing) return existing;
    await area.set({ [KEY]: [...words, record] });
    return record;
  }

  async function deleteWord(word: string): Promise<void> {
    const words = await getAllWords();
    await area.set({ [KEY]: words.filter((w) => w.word.toLowerCase() !== word.toLowerCase()) });
  }

  // Bulk delete (the search view's multi-select) - one read/write instead of one deleteWord() call per
  // word, so removing several words fires a single storage.onChanged instead of one per word.
  async function deleteWords(wordsToDelete: string[]): Promise<void> {
    const lower = new Set(wordsToDelete.map((w) => w.toLowerCase()));
    const words = await getAllWords();
    await area.set({ [KEY]: words.filter((w) => !lower.has(w.word.toLowerCase())) });
  }

  async function updateQuizStats(word: string, known: boolean): Promise<void> {
    const words = await getAllWords();
    const updated = words.map((w) =>
      w.word.toLowerCase() === word.toLowerCase()
        ? { ...w, quizStats: { seen: w.quizStats.seen + 1, known: w.quizStats.known + (known ? 1 : 0) } }
        : w
    );
    await area.set({ [KEY]: updated });
  }

  // Sets the topic on several saved words in one write. Re-reads the list first so words added or deleted while
  // the (slow) model calls were running are kept as they are.
  async function setTopics(topics: Record<string, string>): Promise<void> {
    const byWord = new Map(Object.entries(topics).map(([w, t]) => [w.toLowerCase(), t]));
    const words = await getAllWords();
    await area.set({ [KEY]: words.map((w) => (byWord.has(w.word.toLowerCase()) ? { ...w, topic: byWord.get(w.word.toLowerCase()) } : w)) });
  }

  return { getAllWords, saveWord, deleteWord, deleteWords, updateQuizStats, setTopics };
}
