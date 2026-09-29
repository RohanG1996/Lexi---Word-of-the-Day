// Fixed topic list the model picks from, so search can offer a small, stable set of filter chips.
export const TOPICS = ["Design", "Technology", "Business", "Law", "Science", "Arts", "Health", "Everyday"] as const;
export const OTHER_TOPIC = "Other";

export function normaliseTopic(raw: unknown): string {
  if (typeof raw !== "string") return OTHER_TOPIC;
  const match = TOPICS.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return match ?? OTHER_TOPIC;
}

export interface WordExplanation {
  meaning: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
  topic: string;
}

export function buildExplainPrompt(word: string): string {
  return `Give a concise dictionary-style meaning (max 20 words), one natural example sentence, an IPA pronunciation, the part of speech, and the single best-fitting topic (one of: ${TOPICS.join(", ")}) for the word "${word}". Respond as JSON: {"meaning": "...", "example": "...", "pronunciation": "/.../", "partOfSpeech": "noun", "topic": "Everyday"}. No other text.`;
}

export function parseExplainResponse(raw: string): WordExplanation {
  const parsed = JSON.parse(raw);
  if (typeof parsed.meaning !== "string" || typeof parsed.example !== "string") {
    throw new Error("Malformed explanation response");
  }
  return {
    meaning: parsed.meaning,
    example: parsed.example,
    pronunciation: typeof parsed.pronunciation === "string" ? parsed.pronunciation : "",
    partOfSpeech: typeof parsed.partOfSpeech === "string" ? parsed.partOfSpeech : "",
    topic: normaliseTopic(parsed.topic),
  };
}

// `preference` is an optional sentence about the reader (their goal / industry, see profilePreference) that steers the pick.
export function buildWordOfDayPrompt(previousWords: string[], preference?: string): string {
  const exclude = previousWords.length
    ? ` Avoid these already-used words: ${previousWords.join(", ")}.`
    : "";
  const audience = preference ? ` ${preference} Choose a word that suits them.` : "";
  return `Pick one interesting English word suitable for a "word of the day" feature (moderately advanced, not obscure jargon).${audience}${exclude} Respond as JSON: {"word": "..."}. No other text.`;
}

export function parseWordOfDayResponse(raw: string): string {
  const parsed = JSON.parse(raw);
  if (typeof parsed.word !== "string" || !parsed.word.trim()) {
    throw new Error("Malformed word-of-day response");
  }
  return parsed.word.trim();
}
