import type { StorageArea } from "./storage";
import { isProvider, type Provider } from "./providers";

const KEY = "lexi.apiKey";

export interface ApiKeySettings {
  provider: Provider;
  key: string;
}

function isApiKeySettings(value: unknown): value is ApiKeySettings {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiKeySettings).key === "string" &&
    isProvider((value as ApiKeySettings).provider)
  );
}

// Intended to be backed by chrome.storage.local (per-device), not chrome.storage.sync.
export function createApiKeyStore(area: StorageArea) {
  async function getSettings(): Promise<ApiKeySettings | null> {
    const data = await area.get(KEY);
    const stored = data[KEY];
    // A key saved before providers existed is a bare string, not
    // { provider, key } — treat that (or any other unrecognized shape) as
    // unset rather than passing a garbage provider/key through.
    return isApiKeySettings(stored) ? stored : null;
  }
  async function setSettings(settings: ApiKeySettings): Promise<void> {
    await area.set({ [KEY]: settings });
  }
  return { getSettings, setSettings };
}

const KEY_PREFIXES: Record<Provider, string> = {
  anthropic: "sk-ant-",
  gemini: "AIza",
  groq: "gsk_",
};

export function isPlausibleApiKey(provider: Provider, key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length >= 8 && trimmed.startsWith(KEY_PREFIXES[provider]);
}
