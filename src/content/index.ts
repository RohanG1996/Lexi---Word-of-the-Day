import { mountWidget } from "./widget";

async function main() {
  const syncData = await chrome.storage.sync.get("lexi.todayWord");
  const today = syncData["lexi.todayWord"] as { date: string; word: string } | undefined;
  if (!today) return;

  const localData = await chrome.storage.local.get("lexi.cache");
  const cache = (localData["lexi.cache"] as Record<string, { meaning: string; example: string }>) ?? {};
  const detail = cache[today.word.toLowerCase()];
  if (!detail) return;

  mountWidget({ word: today.word, meaning: detail.meaning, example: detail.example });
}

main();
