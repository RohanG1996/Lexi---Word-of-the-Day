import { createWidgetHost } from "./widget";
import { createWidgetController } from "./widgetController";
import { createTodayWordStore } from "../lib/dailyWord";
import { createDetailCache } from "../lib/cache";
import { createWordStore } from "../lib/storage";
import { createWidgetStateStore, WIDGET_STATE_KEY } from "../lib/widgetState";
import { saveTodayWord } from "../lib/wordOfDayService";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// This script is declared in the manifest, so it runs in EVERY tab (and the background worker also injects it into
// tabs that were already open); the flag stops a second copy in the same tab from double-drawing. Whether the widget
// is on screen, expanded or minimised comes from shared storage, so all tabs show the same thing and change together.
const FLAG = "__lexiWidgetLoaded";

// After the extension is reloaded or updated, tabs that were already open keep a "ghost" copy of this script whose
// chrome.* calls all throw "Extension context invalidated". Its widget can no longer hear the shared state, so it
// would sit on the page forever (a pill that never goes away). A live copy notices this and removes its own UI.
function extensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

// Ghost widgets from before a reload live in another isolated world, so the flag below doesn't see them: clear
// their leftover host elements before drawing a fresh one.
function removeStaleHosts(): void {
  document.querySelectorAll("#lexi-widget-host").forEach((el) => el.remove());
}

async function main() {
  const w = window as unknown as Record<string, unknown>;
  if (w[FLAG]) return;
  w[FLAG] = true;
  removeStaleHosts();

  const todayWordStore = createTodayWordStore(chrome.storage.sync);
  const detailCache = createDetailCache(chrome.storage.local);
  const wordStore = createWordStore(chrome.storage.sync);
  const widgetState = createWidgetStateStore(chrome.storage.local);

  const host = createWidgetHost({
    onClose: () => void whenAlive(() => controller.handlers.onClose()),
    onToggleCollapse: () => void whenAlive(() => controller.handlers.onToggleCollapse()),
    onSave: () => whenAlive(() => controller.handlers.onSave()),
  });

  const controller = createWidgetController({
    state: { get: widgetState.getState, set: widgetState.setState },
    today: todayISO,
    async todayWord() {
      const record = await todayWordStore.getTodayWord();
      if (!record || record.date !== todayISO()) return null;
      const detail = await detailCache.getDetail(record.word);
      if (!detail) return null;
      const saved = (await wordStore.getAllWords()).some((x) => x.word.toLowerCase() === record.word.toLowerCase());
      return {
        data: {
          word: record.word,
          meaning: detail.meaning,
          example: detail.example,
          pronunciation: detail.pronunciation,
          partOfSpeech: detail.partOfSpeech,
        },
        saved,
      };
    },
    // saveTodayWord only touches chrome.storage (no model call - everything it needs is already cached by
    // ensureTodayWord), so unlike the highlight-to-save popover's addWord flow, this doesn't need to go through
    // the background service worker to dodge the host page's CSP.
    async save() {
      await saveTodayWord({ todayWordStore, wordStore, detailCache, today: todayISO });
    },
    host,
  });

  // Every entry point (page load, a storage change, a click) goes through here: if the extension was reloaded under
  // this tab, take the widget down instead of throwing "Extension context invalidated".
  function whenAlive<T>(fn: () => Promise<T> | T): Promise<T | undefined> {
    if (!extensionAlive()) {
      host.update(null);
      return Promise.resolve(undefined);
    }
    return Promise.resolve()
      .then(fn)
      .catch((err) => {
        if (!extensionAlive()) host.update(null);
        else throw err;
        return undefined;
      });
  }

  // Page load: show whatever today's shared state says (no animation - the widget is just "there").
  await whenAlive(() => controller.refresh(false));

  // Any tab changing the state (minimise, close, the day's word arriving, a save) reaches every tab from here.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[WIDGET_STATE_KEY] || changes["lexi.words"] || changes["lexi.todayWord"] || changes["lexi.cache"]) {
      void whenAlive(() => controller.refresh(Boolean(changes[WIDGET_STATE_KEY])));
    }
  });
}

main();
