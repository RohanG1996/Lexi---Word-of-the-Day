import type { Provider } from "./providers";
import { buildExplainPrompt, parseExplainResponse, buildWordOfDayPrompt, parseWordOfDayResponse } from "./prompts";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import type { WordExplanation } from "./prompts";

export type { WordExplanation };

export interface ModelClient {
  explainWord(word: string): Promise<WordExplanation>;
  pickWordOfDay(previousWords: string[]): Promise<string>;
}

type Caller = (apiKey: string, prompt: string) => Promise<string>;

const callers: Record<Provider, Caller> = {
  anthropic: callAnthropic,
  gemini: callGemini,
  groq: callGroq,
};

export function createModelClient(provider: Provider, apiKey: string): ModelClient {
  const call = callers[provider];
  return {
    async explainWord(word: string) {
      return parseExplainResponse(await call(apiKey, buildExplainPrompt(word)));
    },
    async pickWordOfDay(previousWords: string[]) {
      return parseWordOfDayResponse(await call(apiKey, buildWordOfDayPrompt(previousWords)));
    },
  };
}
