import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createTodayWordStore, createLastShownStore } from "../lib/dailyWord";
import { createClaudeClient } from "../lib/claudeClient";
import { ensureTodayWord, shouldInjectWidget, markWidgetShown } from "../lib/wordOfDayService";
import { addWord } from "../lib/addWord";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDeps() {
  const apiKeyStore = createApiKeyStore(chrome.storage.local);
  const apiKey = await apiKeyStore.getApiKey();
  return {
    apiKey,
    claude: apiKey ? createClaudeClient(apiKey) : null,
    wordStore: createWordStore(chrome.storage.sync),
    detailCache: createDetailCache(chrome.storage.local),
    todayWordStore: createTodayWordStore(chrome.storage.sync),
    lastShownStore: createLastShownStore(chrome.storage.local),
  };
}

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first so re-registering is idempotent across install/update —
  // on an "update" onInstalled fire, the item from the previous version can
  // still be registered, and a bare create() would reject on the duplicate id.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "lexi-add-word",
      title: "Add to Lexi",
      contexts: ["selection"],
    });
  });
});

// Clicking the toolbar icon opens the side panel instead of a popup.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
  console.error("Lexi: failed to set side panel behavior", err);
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "lexi-add-word" || !info.selectionText) return;
  try {
    const deps = await getDeps();
    if (!deps.claude) return; // no API key set yet — see options page
    await addWord(
      { claude: deps.claude, wordStore: deps.wordStore, detailCache: deps.detailCache, today: todayISO },
      info.selectionText
    );
  } catch (err) {
    console.error("Lexi: failed to add word", err);
  }
});

// Guards against chrome.tabs.onActivated and chrome.windows.onFocusChanged both
// firing for the same tab-switch and racing into overlapping maybeShowWidget
// calls for that tab (both would pass the shouldInjectWidget check before
// either writes, double-calling the Claude API and double-injecting the
// content script). Keyed per-tab so an unrelated tab switch that happens
// while a different tab's call is in flight is not dropped.
// This only protects against overlap within one service-worker lifetime —
// Chrome can terminate/restart the worker between calls — which is an
// accepted limitation for v1.
const inFlightTabs = new Set<number>();

async function maybeShowWidget(tabId: number) {
  if (inFlightTabs.has(tabId)) return;
  inFlightTabs.add(tabId);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || !(tab.url.startsWith("http://") || tab.url.startsWith("https://"))) return;

    const deps = await getDeps();
    if (!deps.claude) return;

    if (!(await shouldInjectWidget({ lastShownStore: deps.lastShownStore, today: todayISO }))) return;

    await ensureTodayWord({
      claude: deps.claude,
      todayWordStore: deps.todayWordStore,
      lastShownStore: deps.lastShownStore,
      wordStore: deps.wordStore,
      detailCache: deps.detailCache,
      today: todayISO,
    });

    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await markWidgetShown({ lastShownStore: deps.lastShownStore, today: todayISO });
  } catch (err) {
    console.error("Lexi: failed to show widget", err);
  } finally {
    inFlightTabs.delete(tabId);
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  maybeShowWidget(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id !== undefined) maybeShowWidget(tab.id);
});
