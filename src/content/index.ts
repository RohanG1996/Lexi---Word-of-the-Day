import { mountWidget } from "./widget";
import { createTodayWordStore } from "../lib/dailyWord";
import { createDetailCache } from "../lib/cache";
import { ADD_WORD_MESSAGE, type AddWordResponse } from "../lib/messages";

async function main() {
  const todayWordStore = createTodayWordStore(chrome.storage.sync);
  const detailCache = createDetailCache(chrome.storage.local);

  const today = await todayWordStore.getTodayWord();
  if (!today) return;

  const detail = await detailCache.getDetail(today.word);
  if (!detail) return;

  mountWidget(
    {
      word: today.word,
      meaning: detail.meaning,
      example: detail.example,
      pronunciation: detail.pronunciation,
      partOfSpeech: detail.partOfSpeech,
    },
    {
      async onSave() {
        const response = (await chrome.runtime.sendMessage({
          type: ADD_WORD_MESSAGE,
          word: today.word,
        })) as AddWordResponse | undefined;
        if (!response?.ok) throw new Error(response?.error ?? "Couldn't save that word.");
      },
    }
  );
}

main();
