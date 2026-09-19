export interface CompactWordRecord {
  word: string;
  shortMeaning: string;
  savedDate: string; // ISO date, YYYY-MM-DD
  source: "daily" | "manual";
  quizStats: { seen: number; known: number };
}

export interface FullWordDetail {
  word: string;
  meaning: string;
  example: string;
  cachedAt: string; // ISO date
}
