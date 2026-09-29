import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createTodayWordStore, createLastShownStore } from "../lib/dailyWord";
import { createModelClient } from "../lib/modelClient";
import { ensureTodayWord, shouldInjectWidget, markWidgetShown } from "../lib/wordOfDayService";
import { addWord } from "../lib/addWord";
import { createProfileStore, hasArrived, profilePreference } from "../lib/profile";
import {
  ADD_WORD_MESSAGE,
  SIGN_IN_MESSAGE,
  SHOW_ONBOARDING_MESSAGE,
  type AddWordRequest,
  type AddWordResponse,
  type SignInResponse,
} from "../lib/messages";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDeps() {
  const apiKeyStore = createApiKeyStore(chrome.storage.local);
  const settings = await apiKeyStore.getSettings();
  return {
    settings,
    model: settings ? createModelClient(settings.provider, settings.key) : null,
    wordStore: createWordStore(chrome.storage.sync),
    detailCache: createDetailCache(chrome.storage.local),
    todayWordStore: createTodayWordStore(chrome.storage.sync),
    lastShownStore: createLastShownStore(chrome.storage.local),
    profileStore: createProfileStore(chrome.storage.sync),
  };
}

// Shows the first-run onboarding pop-up on the current web page. Extension pages and chrome:// tabs can't be
// scripted, so when there's no ordinary page to show it on, open Lexi's own welcome tab instead.
async function showOnboarding(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== undefined && tab.url && /^https?:/.test(tab.url)) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["onboarding.js"] });
      return;
    }
  } catch (err) {
    console.error("Lexi: couldn't show onboarding on this page", err);
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") showOnboarding();
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
    if (!deps.model) return; // no API key set yet — see options page
    await addWord(
      { model: deps.model, wordStore: deps.wordStore, detailCache: deps.detailCache, today: todayISO },
      info.selectionText
    );
  } catch (err) {
    console.error("Lexi: failed to add word", err);
  }
});

// Guards against chrome.tabs.onActivated and chrome.windows.onFocusChanged both
// firing for the same tab-switch and racing into overlapping maybeShowWidget
// calls for that tab (both would pass the shouldInjectWidget check before
// either writes, double-calling the model API and double-injecting the
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

    // Until onboarding is finished it takes the widget's place, so a new tab keeps offering it.
    const profile = await deps.profileStore.getProfile();
    if (!profile.onboarded) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["onboarding.js"] });
      return;
    }
    if (!deps.model) return;
    // The word is held back until the arrival time chosen in onboarding / Settings.
    if (!hasArrived(new Date(), profile.arrivalTime)) return;

    if (!(await shouldInjectWidget({ lastShownStore: deps.lastShownStore, today: todayISO }))) return;

    await ensureTodayWord({
      model: deps.model,
      todayWordStore: deps.todayWordStore,
      lastShownStore: deps.lastShownStore,
      wordStore: deps.wordStore,
      detailCache: deps.detailCache,
      today: todayISO,
      preference: profilePreference(profile),
    });

    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await markWidgetShown({ lastShownStore: deps.lastShownStore, today: todayISO });
  } catch (err) {
    console.error("Lexi: failed to show widget", err);
  } finally {
    inFlightTabs.delete(tabId);
  }
}

// Content scripts run inside the host page, so their own fetch() is subject
// to that page's Content-Security-Policy - host_permissions in the manifest
// only exempts privileged extension contexts (this service worker, extension
// pages) from that, not a content script's own network calls. So the
// highlight-to-save popover and the widget's save button don't call the
// model API themselves; they message this listener, which runs the real
// addWord() call from here instead, where it isn't subject to page CSP.
chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse: (r: SignInResponse) => void) => {
  // The onboarding pop-up (a content script) can't use chrome.identity, so it asks here for the account email of
  // the Google account the browser is signed into. null when the browser isn't signed in.
  if (message?.type !== SIGN_IN_MESSAGE) return undefined;
  chrome.identity
    .getProfileUserInfo({ accountStatus: chrome.identity.AccountStatus.ANY })
    .then((info) => sendResponse({ ok: true, email: info.email || null }))
    .catch(() => sendResponse({ ok: true, email: null }));
  return true;
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === SHOW_ONBOARDING_MESSAGE) showOnboarding();
  return undefined;
});

chrome.runtime.onMessage.addListener((message: AddWordRequest, _sender, sendResponse: (r: AddWordResponse) => void) => {
  if (message?.type !== ADD_WORD_MESSAGE || typeof message.word !== "string") return undefined;
  (async () => {
    try {
      const deps = await getDeps();
      if (!deps.model) {
        sendResponse({ ok: false, error: "Add your API key in Options first." });
        return;
      }
      const record = await addWord(
        { model: deps.model, wordStore: deps.wordStore, detailCache: deps.detailCache, today: todayISO },
        message.word
      );
      sendResponse({ ok: true, record });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : "Couldn't save that word." });
    }
  })();
  return true; // keep the message channel open for the async sendResponse above
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  maybeShowWidget(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id !== undefined) maybeShowWidget(tab.id);
});
