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

// After the extension is reloaded/updated, content scripts already injected in
// open tabs are orphaned: chrome.runtime is gone (or throws "context
// invalidated"). Sending from one would surface a raw TypeError, so callers
// use this instead to get a message the user can act on.
export async function requestAddWord(word: string): Promise<AddWordResponse | undefined> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("Lexi was updated - refresh this page and try again.");
  }
  try {
    return (await chrome.runtime.sendMessage({ type: ADD_WORD_MESSAGE, word } satisfies AddWordRequest)) as
      | AddWordResponse
      | undefined;
  } catch (e) {
    if (e instanceof Error && /context invalidated/i.test(e.message)) {
      throw new Error("Lexi was updated - refresh this page and try again.");
    }
    throw e;
  }
}
