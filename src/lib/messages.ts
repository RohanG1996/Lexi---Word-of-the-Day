import type { CompactWordRecord } from "./types";

// Content scripts can't call the model API themselves (their fetch() is
// subject to the host page's CSP - see background/index.ts), so they send
// this message and the background service worker runs addWord() instead.
export const ADD_WORD_MESSAGE = "lexi/addWord" as const;

export interface AddWordRequest {
  type: typeof ADD_WORD_MESSAGE;
  word: string;
}

export type AddWordResponse = { ok: true; record: CompactWordRecord } | { ok: false; error: string };
