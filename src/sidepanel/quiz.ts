import type { CompactWordRecord } from "../lib/types";

export function pickNextQuizWord(words: CompactWordRecord[]): CompactWordRecord | null {
  if (words.length === 0) return null;
  const priority = (w: CompactWordRecord) =>
    w.quizStats.seen === 0 ? -1 : w.quizStats.known / w.quizStats.seen;
  return [...words].sort((a, b) => priority(a) - priority(b))[0];
}
