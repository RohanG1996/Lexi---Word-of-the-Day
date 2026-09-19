import type { FullWordDetail } from "./types";
import type { StorageArea } from "./storage";

const KEY = "lexi.cache";

// Intended to be backed by chrome.storage.local (per-device), not chrome.storage.sync.
export function createDetailCache(area: StorageArea) {
  async function getAll(): Promise<Record<string, FullWordDetail>> {
    const data = await area.get(KEY);
    return (data[KEY] as Record<string, FullWordDetail>) ?? {};
  }

  async function getDetail(word: string): Promise<FullWordDetail | undefined> {
    const all = await getAll();
    return all[word.toLowerCase()];
  }

  async function setDetail(detail: FullWordDetail): Promise<void> {
    const all = await getAll();
    all[detail.word.toLowerCase()] = detail;
    await area.set({ [KEY]: all });
  }

  return { getDetail, setDetail };
}
