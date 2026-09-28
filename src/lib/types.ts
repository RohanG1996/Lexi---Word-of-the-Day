export interface CompactWordRecord {
  word: string;
  shortMeaning: string;
  savedDate: string; // ISO date, YYYY-MM-DD
  source: "daily" | "manual";
  quizStats: { seen: number; known: number };
  // Topic the model assigned when the word was saved (see TOPICS in prompts.ts). Absent on words saved before topics existed.
  topic?: string;
}

export interface FullWordDetail {
  word: string;
  meaning: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
  cachedAt: string; // ISO date
}
