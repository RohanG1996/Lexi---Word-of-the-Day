import type { StorageArea } from "./storage";

const KEY = "lexi.apiKey";

// Intended to be backed by chrome.storage.local (per-device), not chrome.storage.sync.
export function createApiKeyStore(area: StorageArea) {
  async function getApiKey(): Promise<string | null> {
    const data = await area.get(KEY);
    return (data[KEY] as string) ?? null;
  }
  async function setApiKey(key: string): Promise<void> {
    await area.set({ [KEY]: key });
  }
  return { getApiKey, setApiKey };
}

export function isPlausibleApiKey(key: string): boolean {
  return /^sk-ant-/.test(key.trim());
}
