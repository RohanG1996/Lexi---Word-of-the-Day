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

// chrome.identity isn't exposed to content scripts, so the onboarding pop-up asks the background worker for the
// email of the Google account the browser is signed into.
export const SIGN_IN_MESSAGE = "lexi/signIn" as const;

export interface SignInRequest {
  type: typeof SIGN_IN_MESSAGE;
}

export type SignInResponse = { ok: true; email: string | null };

// Settings -> "Delete account" (or any other reason to start over) asks the background worker to show the
// onboarding pop-up on the current tab again.
export const SHOW_ONBOARDING_MESSAGE = "lexi/showOnboarding" as const;

export interface ShowOnboardingRequest {
  type: typeof SHOW_ONBOARDING_MESSAGE;
}

// After the extension is reloaded/updated, content scripts already injected in
// open tabs are orphaned: chrome.runtime is gone (or throws "context
// invalidated"). Sending from one would surface a raw TypeError, so callers
// use this instead to get a message the user can act on.
async function sendToBackground<T>(message: unknown): Promise<T | undefined> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("Lexi was updated - refresh this page and try again.");
  }
  try {
    return (await chrome.runtime.sendMessage(message)) as T | undefined;
  } catch (e) {
    if (e instanceof Error && /context invalidated/i.test(e.message)) {
      throw new Error("Lexi was updated - refresh this page and try again.");
    }
    throw e;
  }
}

export async function requestAddWord(word: string): Promise<AddWordResponse | undefined> {
  return sendToBackground<AddWordResponse>({ type: ADD_WORD_MESSAGE, word } satisfies AddWordRequest);
}

export async function requestSignIn(): Promise<string | null> {
  const response = await sendToBackground<SignInResponse>({ type: SIGN_IN_MESSAGE } satisfies SignInRequest);
  return response?.ok ? response.email : null;
}

export async function requestShowOnboarding(): Promise<void> {
  await sendToBackground({ type: SHOW_ONBOARDING_MESSAGE } satisfies ShowOnboardingRequest);
}
