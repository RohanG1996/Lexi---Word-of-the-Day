import type { StorageArea } from "./storage";

const TODAY_WORD_KEY = "lexi.todayWord"; // sync — shared across your devices
const LAST_SHOWN_KEY = "lexi.lastShownDate"; // local — per device

export interface TodayWordRecord {
  date: string;
  word: string;
  // Carried here (rather than looked up again) because the word isn't written to wordStore until it's actually
  // saved - see saveTodayWord() in wordOfDayService.ts.
  topic?: string;
}

export function createTodayWordStore(syncArea: StorageArea) {
  async function getTodayWord(): Promise<TodayWordRecord | null> {
    const data = await syncArea.get(TODAY_WORD_KEY);
    return (data[TODAY_WORD_KEY] as TodayWordRecord) ?? null;
  }
  async function setTodayWord(record: TodayWordRecord): Promise<void> {
    await syncArea.set({ [TODAY_WORD_KEY]: record });
  }
  return { getTodayWord, setTodayWord };
}

export function createLastShownStore(localArea: StorageArea) {
  async function getLastShownDate(): Promise<string | null> {
    const data = await localArea.get(LAST_SHOWN_KEY);
    return (data[LAST_SHOWN_KEY] as string) ?? null;
  }
  async function setLastShownDate(date: string): Promise<void> {
    await localArea.set({ [LAST_SHOWN_KEY]: date });
  }
  return { getLastShownDate, setLastShownDate };
}
