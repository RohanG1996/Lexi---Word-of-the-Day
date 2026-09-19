export interface WordExplanation {
  meaning: string;
  example: string;
}

const API_URL = "https://api.anthropic.com/v1/messages";
// Placeholder model id - a human should confirm/update this against the
// current generally-available Claude model before shipping.
const MODEL = "claude-sonnet-5";

export function buildExplainPrompt(word: string): string {
  return `Give a concise dictionary-style meaning (max 20 words) and one natural example sentence for the word "${word}". Respond as JSON: {"meaning": "...", "example": "..."}. No other text.`;
}

export function parseExplainResponse(raw: string): WordExplanation {
  const parsed = JSON.parse(raw);
  if (typeof parsed.meaning !== "string" || typeof parsed.example !== "string") {
    throw new Error("Malformed explanation response");
  }
  return { meaning: parsed.meaning, example: parsed.example };
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

export interface ClaudeClient {
  explainWord(word: string): Promise<WordExplanation>;
  pickWordOfDay(previousWords: string[]): Promise<string>;
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text as string;
}

export function createClaudeClient(apiKey: string): ClaudeClient {
  return {
    async explainWord(word: string) {
      return parseExplainResponse(await callClaude(apiKey, buildExplainPrompt(word)));
    },
    async pickWordOfDay(previousWords: string[]) {
      return parseWordOfDayResponse(await callClaude(apiKey, buildWordOfDayPrompt(previousWords)));
    },
  };
}
