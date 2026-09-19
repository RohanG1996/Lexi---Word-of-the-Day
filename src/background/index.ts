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
  chrome.contextMenus.create({
    id: "lexi-add-word",
    title: "Add to Lexi",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "lexi-add-word" || !info.selectionText) return;
  const deps = await getDeps();
  if (!deps.claude) return; // no API key set yet — see options page
  await addWord(
    { claude: deps.claude, wordStore: deps.wordStore, detailCache: deps.detailCache, today: todayISO },
    info.selectionText
  );
});

// Guards against chrome.tabs.onActivated and chrome.windows.onFocusChanged both
// firing for the same tab-switch and racing into overlapping maybeShowWidget
// calls (both would pass the shouldInjectWidget check before either writes,
// double-calling the Claude API and double-injecting the content script).
// This only protects against overlap within one service-worker lifetime —
// Chrome can terminate/restart the worker between calls — which is an
// accepted limitation for v1.
let showingWidget = false;

async function maybeShowWidget(tabId: number) {
  if (showingWidget) return;
  showingWidget = true;
  try {
    const deps = await getDeps();
    if (!deps.claude) return;

    if (!(await shouldInjectWidget({ lastShownStore: deps.lastShownStore, todayDate: todayISO }))) return;

    await ensureTodayWord({
      claude: deps.claude,
      todayWordStore: deps.todayWordStore,
      lastShownStore: deps.lastShownStore,
      wordStore: deps.wordStore,
      detailCache: deps.detailCache,
      todayDate: todayISO,
    });

    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await markWidgetShown({ lastShownStore: deps.lastShownStore, todayDate: todayISO });
  } finally {
    showingWidget = false;
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
