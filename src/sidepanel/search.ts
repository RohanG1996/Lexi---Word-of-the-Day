import type { CompactWordRecord } from "../lib/types";

export function filterWords(words: CompactWordRecord[], query: string): CompactWordRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return words;
  return words.filter(
    (w) => w.word.toLowerCase().includes(q) || w.shortMeaning.toLowerCase().includes(q)
  );
}
