export interface WordExplanation {
  meaning: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
}

export function buildExplainPrompt(word: string): string {
  return `Give a concise dictionary-style meaning (max 20 words), one natural example sentence, an IPA pronunciation, and the part of speech for the word "${word}". Respond as JSON: {"meaning": "...", "example": "...", "pronunciation": "/.../", "partOfSpeech": "noun"}. No other text.`;
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
  };
}

export function buildWordOfDayPrompt(previousWords: string[]): string {
  const exclude = previousWords.length
    ? ` Avoid these already-used words: ${previousWords.join(", ")}.`
    : "";
  return `Pick one interesting English word suitable for a "word of the day" feature (moderately advanced, not obscure jargon).${exclude} Respond as JSON: {"word": "..."}. No other text.`;
}

export function parseWordOfDayResponse(raw: string): string {
  const parsed = JSON.parse(raw);
  if (typeof parsed.word !== "string" || !parsed.word.trim()) {
    throw new Error("Malformed word-of-day response");
  }
  return parsed.word.trim();
}
