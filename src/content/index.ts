import { mountWidget } from "./widget";
import { createTodayWordStore } from "../lib/dailyWord";
import { createDetailCache } from "../lib/cache";
import { createWordStore } from "../lib/storage";
import { saveTodayWord } from "../lib/wordOfDayService";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const todayWordStore = createTodayWordStore(chrome.storage.sync);
  const detailCache = createDetailCache(chrome.storage.local);
  const wordStore = createWordStore(chrome.storage.sync);

  const todayRecord = await todayWordStore.getTodayWord();
  if (!todayRecord) return;

  const detail = await detailCache.getDetail(todayRecord.word);
  if (!detail) return;

  mountWidget(
    {
      word: todayRecord.word,
      meaning: detail.meaning,
      example: detail.example,
      pronunciation: detail.pronunciation,
      partOfSpeech: detail.partOfSpeech,
    },
    {
      // saveTodayWord only touches chrome.storage (no model call - everything it needs is already cached by
      // ensureTodayWord), so unlike the highlight-to-save popover's addWord flow, this doesn't need to go through
      // the background service worker to dodge the host page's CSP.
      async onSave() {
        await saveTodayWord({ todayWordStore, wordStore, detailCache, today: todayISO });
      },
    }
  );
}

main();
