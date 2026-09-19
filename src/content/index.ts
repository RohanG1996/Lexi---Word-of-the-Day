import { mountWidget } from "./widget";
import { createTodayWordStore } from "../lib/dailyWord";
import { createDetailCache } from "../lib/cache";

async function main() {
  const todayWordStore = createTodayWordStore(chrome.storage.sync);
  const detailCache = createDetailCache(chrome.storage.local);

  const today = await todayWordStore.getTodayWord();
  if (!today) return;

  const detail = await detailCache.getDetail(today.word);
  if (!detail) return;

  mountWidget({ word: today.word, meaning: detail.meaning, example: detail.example });
}

main();
