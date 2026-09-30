import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createModelClient } from "../lib/modelClient";
import { addWord } from "../lib/addWord";
import { createTodayWordStore } from "../lib/dailyWord";
import { createWidgetStateStore, WIDGET_STATE_KEY } from "../lib/widgetState";
import { recategoriseWords } from "../lib/recategorise";
import { saveTodayWord } from "../lib/wordOfDayService";
import { shouldShowTodayWordBanner } from "../lib/trigger";
import { OTHER_TOPIC, type WordExplanation } from "../lib/prompts";
import { ALL_TOPICS, newestFirst, searchWords, topicChips } from "./search";
import type { CompactWordRecord } from "../lib/types";
import { createProfileStore } from "../lib/profile";
import { deleteAccountData } from "../lib/account";
import { requestSignIn, requestShowOnboarding } from "../lib/messages";
import { renderSettings, SETTINGS_CSS } from "./settings";
import { animateHeight, collapseAndRemove, collapseSection, expandSection } from "../ui/motion";
import {
  ICON_BOOK,
  ICON_CHECK_CIRCLE,
  ICON_CHECK,
  ICON_BACK,
  ICON_SEARCH,
  ICON_PLUS,
  ICON_SETTINGS,
  ICON_CHEVRON_DOWN,
  ICON_CLOSE_THIN,
  ICON_TRASH,
} from "../lib/icons";

const wordStore = createWordStore(chrome.storage.sync);
const detailCache = createDetailCache(chrome.storage.local);
const todayWordStore = createTodayWordStore(chrome.storage.sync);
const widgetStateStore = createWidgetStateStore(chrome.storage.local);
const profileStore = createProfileStore(chrome.storage.sync);
const today = () => new Date().toISOString().slice(0, 10);

// The shared dropdown / goal / industry controls and the Settings view bring their own styles.
const settingsStyle = document.createElement("style");
settingsStyle.textContent = SETTINGS_CSS;
document.head.appendChild(settingsStyle);

// Library -> Search (search + browsing by topic, replacing the old "All saved words" list), Add a word, or Settings.
type View = "library" | "search" | "save" | "settings";

let view: View = "library";
let searchQuery = "";
let searchTopic = ALL_TOPICS;
// Search's multi-select delete flow (word keys are lowercased). Module-level like searchQuery/searchTopic so it
// survives a re-render triggered by chrome.storage.onChanged while the user is mid-selection.
let selectMode = false;
let selectedWords = new Set<string>();

const app = document.getElementById("app") as HTMLDivElement;

// Saving a word from the content-script highlight popover (or the widget)
// writes to this same chrome.storage.sync key from a different context - keep
// the library and search views live instead of requiring a re-open.
chrome.storage.onChanged.addListener((changes, areaName) => {
  const wordsChanged = areaName === "sync" && changes["lexi.words"];
  // The today's-word banner follows the widget: it appears when the widget is closed and goes when it reopens.
  const widgetChanged = areaName === "local" && changes[WIDGET_STATE_KEY];
  if (!wordsChanged && !widgetChanged) return;
  if (view === "library" || (view === "search" && wordsChanged)) render();
});

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function isThisWeek(record: CompactWordRecord): boolean {
  return new Date(record.savedDate) >= daysAgo(7);
}

// Set by goTo(): the next render is a change of screen, so the new screen eases in. A re-render for any other reason
// (a word saved from elsewhere, the confirmation timing out) must NOT replay that, or the panel would look refreshed.
let animateNextRender = false;
let renderedView: View | null = null;

const scroller = (root: ParentNode): HTMLElement | null => root.querySelector<HTMLElement>(".list, .body");

async function render(): Promise<void> {
  const all = newestFirst(await wordStore.getAllWords());
  // Build the whole next screen first and swap it in one step - clearing the panel while it is still being built
  // is what made the panel flash blank and jump back to the top.
  let next: HTMLElement;
  if (view === "library") next = await renderLibrary(all);
  else if (view === "search") next = renderSearch(all);
  else if (view === "settings") next = await renderSettingsView();
  else next = renderSave();

  const sameScreen = renderedView === view;
  const prevScroll = sameScreen ? scroller(app)?.scrollTop ?? 0 : 0;
  const prevBannerHeight = sameScreen ? app.querySelector<HTMLElement>(".todayBanner")?.offsetHeight ?? null : null;

  app.replaceChildren(next);
  renderedView = view;

  if (prevScroll) {
    const s = scroller(next);
    if (s) s.scrollTop = prevScroll;
  }
  if (animateNextRender) {
    animateNextRender = false;
    next.classList.add("enter");
  }
  // The banner swapped for the confirmation (or back) has a different height: glide between the two so the list
  // moves up smoothly instead of jumping.
  const banner = next.querySelector<HTMLElement>(".todayBanner");
  if (banner && prevBannerHeight !== null) {
    const height = banner.offsetHeight;
    if (Math.abs(height - prevBannerHeight) > 1) void animateHeight(banner, prevBannerHeight, height);
  }
}

// Settings edits the same profile the onboarding pop-up creates. "Delete account" wipes everything Lexi stores for
// the user and then re-opens onboarding on the current page.
async function renderSettingsView(): Promise<HTMLDivElement> {
  return renderSettings({
    profile: await profileStore.getProfile(),
    save: (p) => profileStore.setProfile(p),
    signIn: requestSignIn,
    signOut: async () => {
      await profileStore.updateProfile({ email: "" });
    },
    confirmDelete: () => window.confirm("Delete your account and all saved words? This can't be undone."),
    deleteAccount: () => deleteAccountData(chrome.storage.sync, chrome.storage.local),
    onBack: () => goTo("library"),
    onDeleted: () => {
      requestShowOnboarding().catch(() => {});
      goTo("library");
    },
  });
}

function goTo(next: View): void {
  if (view === "search" && next !== "search") {
    selectMode = false;
    selectedWords.clear();
  }
  if (next !== view) animateNextRender = true;
  view = next;
  render();
}

// A saved word is normally an accordion: one click on the row shows the pronunciation, full meaning and example
// (read lazily from the local detail cache, falling back to the short meaning). Opening one row closes any other.
// In Search's select mode (select != null) the row instead shows a checkbox in place of the chevron, and a click
// toggles it rather than opening the accordion - see renderSearch's delete flow.
function wordRow(
  w: CompactWordRecord,
  highlight = "",
  select: { checked: boolean; onToggle: () => void } | null = null
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = select
    ? `
    <button class="rowHead selectRow" aria-pressed="${select.checked}">
      <span class="checkbox ${select.checked ? "checked" : ""}" aria-hidden="true">${select.checked ? ICON_CHECK : ""}</span>
      <div class="rowText"><div class="word"></div><div class="meaning"></div></div>
    </button>
  `
    : `
    <button class="rowHead" aria-expanded="false">
      <div class="rowText"><div class="word"></div><div class="meaning"></div></div>
      <span class="chev" aria-hidden="true">${ICON_CHEVRON_DOWN}</span>
    </button>
    <div class="rowBody" hidden></div>
  `;
  const wordEl = row.querySelector(".word") as HTMLElement;
  const q = highlight.trim();
  if (q && w.word.toLowerCase().startsWith(q.toLowerCase())) {
    const bold = document.createElement("b");
    bold.textContent = w.word.slice(0, q.length);
    wordEl.append(bold, w.word.slice(q.length));
  } else {
    wordEl.textContent = w.word;
  }
  row.querySelector(".meaning")!.textContent = w.shortMeaning;

  if (select) {
    (row.querySelector(".rowHead") as HTMLButtonElement).addEventListener("click", select.onToggle);
    return row;
  }

  const head = row.querySelector(".rowHead") as HTMLButtonElement;
  const body = row.querySelector(".rowBody") as HTMLDivElement;
  let loaded = false;

  async function fillBody(): Promise<void> {
    const detail = await detailCache.getDetail(w.word);
    const hasPron = Boolean(detail?.pronunciation || detail?.partOfSpeech);
    const hasExample = Boolean(detail?.example);
    body.innerHTML = `
      <div class="pron" ${hasPron ? "" : "hidden"}></div>
      <div class="full"></div>
      <div class="exBox" ${hasExample ? "" : "hidden"}>
        <div class="exLabel">Example</div>
        <div class="ex"></div>
      </div>
    `;
    const pron = body.querySelector(".pron") as HTMLDivElement;
    pron.textContent = detail?.pronunciation ?? "";
    if (detail?.partOfSpeech) {
      const pos = document.createElement("i");
      pos.textContent = detail.partOfSpeech;
      pron.appendChild(pos);
    }
    body.querySelector(".full")!.textContent = detail?.meaning || w.shortMeaning;
    body.querySelector(".ex")!.textContent = detail?.example ?? "";
  }

  head.addEventListener("click", async () => {
    const opening = !row.classList.contains("open");
    if (opening) {
      for (const other of app.querySelectorAll<HTMLElement>(".row.open")) {
        other.classList.remove("open");
        other.querySelector(".rowHead")!.setAttribute("aria-expanded", "false");
        void collapseSection(other.querySelector(".rowBody") as HTMLElement);
      }
      if (!loaded) {
        loaded = true;
        await fillBody();
      }
    }
    row.classList.toggle("open", opening);
    head.setAttribute("aria-expanded", String(opening));
    // the word opens and closes with a height glide rather than snapping
    void (opening ? expandSection(body) : collapseSection(body));
  });
  return row;
}

function backHeader(title: string): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "subHeader";
  header.innerHTML = `
    <button class="iconBtn back" aria-label="Back">${ICON_BACK}</button>
    <div class="title"></div>
  `;
  header.querySelector(".title")!.textContent = title;
  header.querySelector(".back")!.addEventListener("click", () => goTo("library"));
  return header;
}

// After "Add" on the today's-word banner, a confirmation card takes the banner's place for a few seconds (long
// enough to notice the word landed in the list) and then the space closes. Module-level like searchQuery, so it
// survives the re-render the save itself triggers.
const ADDED_CONFIRMATION_MS = 5000;
let justAdded: string | null = null;
let justAddedTimer: ReturnType<typeof setTimeout> | null = null;

function clearAddedConfirmation(): void {
  justAdded = null;
  if (justAddedTimer) clearTimeout(justAddedTimer);
  justAddedTimer = null;
}

function showAddedConfirmation(word: string): void {
  clearAddedConfirmation();
  justAdded = word;
  justAddedTimer = setTimeout(async () => {
    justAddedTimer = null;
    // Fade the confirmation out while its space closes up, so the list glides to the top. Only once that is done is
    // the panel re-rendered - and by then the layout already matches, so nothing visibly changes.
    const banner = view === "library" ? app.querySelector<HTMLElement>(".todayBanner") : null;
    if (banner) await collapseAndRemove(banner);
    justAdded = null;
    if (view === "library") render();
  }, ADDED_CONFIRMATION_MS);
}

function renderAddedConfirmation(word: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "todayBanner";
  wrap.innerHTML = `
    <div class="addedCard" role="status">
      <span class="addedIcon" aria-hidden="true">${ICON_CHECK_CIRCLE}</span>
      <div>
        <div class="addedTitle">Added to your library</div>
        <div class="addedSub"><span class="addedWord"></span> is now in this week's list.</div>
      </div>
    </div>
    <div class="addedGap"></div>
  `;
  wrap.querySelector(".addedWord")!.textContent = word;
  return wrap;
}

const EMPTY_ART = `<svg viewBox="0 0 240 150" role="img" aria-label="A ruled notebook card with one word highlighted">
  <rect x="1" y="1" width="238" height="148" rx="10" fill="#fff" stroke="rgba(110,155,215,0.55)" stroke-width="1.5"/>
  <line x1="36" y1="1" x2="36" y2="149" stroke="rgba(214,100,96,0.75)" stroke-width="1.5"/>
  <g stroke="rgba(110,155,215,0.35)" stroke-width="1"><line x1="1" y1="44" x2="239" y2="44"/><line x1="1" y1="74" x2="239" y2="74"/><line x1="1" y1="104" x2="239" y2="104"/><line x1="1" y1="134" x2="239" y2="134"/></g>
  <rect x="52" y="20" width="98" height="24" rx="3" fill="#f3e3a6"/>
  <text x="56" y="39" font-family="Cormorant Garamond, Georgia, serif" font-size="21" font-weight="500" fill="#171717">serendipity</text>
  <rect x="160" y="27" width="64" height="7" rx="3.5" fill="rgba(23,23,23,0.1)"/>
  <path transform="translate(112 52)" d="M0 0 L0 15 L4 11.5 L7 18 L10 16.5 L7 10.5 L12.5 10.5 Z" fill="#171717" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
</svg>`;

// Compact when the today's-word banner is above it, so both fit without scrolling.
function renderEmptyState(compact: boolean, onAdd: () => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = compact ? "emptyState compact" : "emptyState";
  wrap.innerHTML = `
    <div class="emptyArt">${EMPTY_ART}</div>
    <div class="emptyBrand">Lexi</div>
    <h1 class="emptyTitle">Never forget a word you see.</h1>
    <p class="emptyText">Highlight any word on a page and Lexi keeps it here, with its meaning and an example.</p>
    <button class="emptyCta">${ICON_PLUS}Add your first word</button>
    <div class="emptyHint">or highlight a word on any page</div>
  `;
  wrap.querySelector(".emptyCta")!.addEventListener("click", onAdd);
  return wrap;
}

// The today's-word banner: a fallback for a widget closed without saving. Shown only while the widget is closed
// and the word is still unsaved (shouldShowTodayWordBanner); disappears on its own once the
// word is added (the chrome.storage.onChanged listener above re-renders the library) or once the day turns over.
async function renderTodayWordBanner(all: CompactWordRecord[]): Promise<HTMLDivElement | null> {
  // Just added: show the confirmation instead of the banner until it times out (see showAddedConfirmation).
  if (justAdded) return renderAddedConfirmation(justAdded);

  const record = await todayWordStore.getTodayWord();
  if (!record) return null;

  const alreadySaved = all.some((w) => w.word.toLowerCase() === record.word.toLowerCase());
  const show = shouldShowTodayWordBanner({
    todayWordDate: record.date,
    currentDate: today(),
    widgetState: await widgetStateStore.getState(),
    alreadySaved,
  });
  if (!show) return null;

  const detail = await detailCache.getDetail(record.word);

  const wrap = document.createElement("div");
  wrap.className = "todayBanner";
  wrap.innerHTML = `
    <div class="todayCard">
      <div class="todayHead">
        <div class="todayInfo">
          <div class="todayLabel">Word of the day</div>
          <div class="todayWord"></div>
          <div class="todayPron"></div>
        </div>
        <button class="todayAddBtn">${ICON_PLUS}Add</button>
      </div>
      <div class="todayMeaning"></div>
      <div class="todayExLabel" hidden>Example</div>
      <div class="todayEx" hidden></div>
    </div>
    <div class="todayCaption">Add the word to your library before the day ends.</div>
    <div class="err"></div>
  `;
  wrap.querySelector(".todayWord")!.textContent = record.word;
  const pronEl = wrap.querySelector(".todayPron") as HTMLElement;
  pronEl.textContent = detail?.pronunciation ?? "";
  if (detail?.partOfSpeech) {
    const pos = document.createElement("i");
    pos.textContent = detail.partOfSpeech;
    pronEl.appendChild(pos);
  }
  wrap.querySelector(".todayMeaning")!.textContent = detail?.meaning ?? "";
  if (detail?.example) {
    (wrap.querySelector(".todayExLabel") as HTMLElement).hidden = false;
    const exEl = wrap.querySelector(".todayEx") as HTMLElement;
    exEl.hidden = false;
    exEl.textContent = detail.example;
  }

  const addBtn = wrap.querySelector(".todayAddBtn") as HTMLButtonElement;
  const errEl = wrap.querySelector(".err") as HTMLDivElement;
  addBtn.addEventListener("click", async () => {
    errEl.textContent = "";
    addBtn.disabled = true;
    addBtn.innerHTML = "Saving…";
    try {
      // Start the confirmation BEFORE saving: saveWord's write to lexi.words fires the storage.onChanged listener
      // above, whose re-render then already shows the confirmation instead of dropping the banner outright.
      showAddedConfirmation(record.word);
      await saveTodayWord({ todayWordStore, wordStore, detailCache, today });
    } catch (e) {
      clearAddedConfirmation();
      addBtn.disabled = false;
      addBtn.innerHTML = `${ICON_PLUS}Add`;
      errEl.textContent = e instanceof Error ? e.message : "Couldn't add that word.";
    }
  });

  return wrap;
}

async function renderLibrary(all: CompactWordRecord[]): Promise<HTMLDivElement> {
  const panel = document.createElement("div");
  panel.className = "panel";

  const weekWords = all.filter(isThisWeek);
  const isNewUser = all.length === 0;

  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `
    <div class="who">
      <div class="name">Your Library</div>
      <div class="label"></div>
    </div>
    <div class="headBtns">
      <button class="iconBtn settingsBtn" aria-label="Settings">${ICON_SETTINGS}</button>
    </div>
  `;
  header.querySelector(".label")!.textContent = isNewUser ? "Nothing saved yet" : `${weekWords.length} saved this week`;
  // The name chosen in onboarding titles the library ("Priya's Library"); before that it's just "Your Library".
  const { name } = await profileStore.getProfile();
  if (name.trim()) header.querySelector(".name")!.textContent = `${name.trim()}'s Library`;
  header.querySelector(".settingsBtn")!.addEventListener("click", () => goTo("settings"));
  panel.appendChild(header);

  const banner = await renderTodayWordBanner(all);
  if (banner) panel.appendChild(banner);

  // Nothing saved yet: the finalised "Side panel - empty state (new user)" board. Its own button replaces the
  // Search / Add a word footer, which has nothing to search yet.
  if (isNewUser) {
    panel.appendChild(renderEmptyState(Boolean(banner), () => goTo("save")));
    return panel;
  }

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "label section";
  sectionLabel.textContent = "This week";

  const list = document.createElement("div");
  list.className = "list";
  list.appendChild(sectionLabel);
  if (weekWords.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No words saved this week yet.";
    list.appendChild(empty);
  } else {
    for (const w of weekWords) list.appendChild(wordRow(w));
  }
  panel.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = `
    <button class="pillBtn searchBtn">${ICON_SEARCH}Search</button>
    <button class="pillBtn saveBtn">${ICON_PLUS}Add a word</button>
  `;
  footer.querySelector(".searchBtn")!.addEventListener("click", () => {
    searchQuery = "";
    searchTopic = ALL_TOPICS;
    goTo("search");
  });
  footer.querySelector(".saveBtn")!.addEventListener("click", () => goTo("save"));
  panel.appendChild(footer);

  return panel;
}

// Search combines the old search and "All saved words": a search field, filter chips that auto-categorise the
// library by topic, and one list. With All selected the list is flat; picking a chip shows that topic under its title.
// The header's trash icon turns on select mode: rows show checkboxes instead of chevrons, the header swaps to
// Cancel / "N selected" / Select all, and a bottom drawer replaces the space below the list with a warning line and
// a "Delete from library (N)" button - see the finalised "Search - topics, all words, with delete icon" and
// "Search - checkboxes, delete drawer on the panel background" canvas boards.
function renderSearch(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";

  const headerSlot = document.createElement("div");
  panel.appendChild(headerSlot);

  const chips = topicChips(all);
  if (searchTopic !== ALL_TOPICS && !chips.some((c) => c.topic === searchTopic)) searchTopic = ALL_TOPICS;

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="searchWrap">
      <label class="searchField">
        <span class="sIcon">${ICON_SEARCH}</span>
        <input class="sInput" type="text" placeholder="Search words, meanings, topics" aria-label="Search your words" />
        <button class="clearBtn" aria-label="Clear search" hidden>${ICON_CLOSE_THIN}</button>
      </label>
      <div class="chips"></div>
    </div>
    <div class="results"></div>
  `;
  panel.appendChild(body);

  const drawerSlot = document.createElement("div");
  panel.appendChild(drawerSlot);

  const input = body.querySelector(".sInput") as HTMLInputElement;
  const clearBtn = body.querySelector(".clearBtn") as HTMLButtonElement;
  const chipsEl = body.querySelector(".chips") as HTMLDivElement;
  const results = body.querySelector(".results") as HTMLDivElement;
  input.value = searchQuery;

  function currentMatches(): CompactWordRecord[] {
    return searchWords(all, searchQuery, searchTopic);
  }

  function renderHeader(): void {
    headerSlot.innerHTML = "";
    if (selectMode) {
      const header = document.createElement("div");
      header.className = "subHeader selectHeader";
      header.innerHTML = `
        <button class="textBtn cancelBtn">Cancel</button>
        <div class="title"></div>
        <button class="textBtn strong selectAllBtn"></button>
      `;
      header.querySelector(".title")!.textContent = `${selectedWords.size} selected`;
      const matches = currentMatches();
      const allSelected = matches.length > 0 && matches.every((w) => selectedWords.has(w.word.toLowerCase()));
      header.querySelector(".selectAllBtn")!.textContent = allSelected ? "Deselect all" : "Select all";
      header.querySelector(".cancelBtn")!.addEventListener("click", () => {
        selectMode = false;
        selectedWords.clear();
        renderHeader();
        renderResults();
        renderDrawer();
      });
      header.querySelector(".selectAllBtn")!.addEventListener("click", () => {
        if (allSelected) selectedWords.clear();
        else for (const w of matches) selectedWords.add(w.word.toLowerCase());
        renderHeader();
        renderResults();
        renderDrawer();
      });
      headerSlot.appendChild(header);
    } else {
      const header = backHeader("Search");
      // backHeader's own .title is the "Search" heading; wrap it with the count so the two sit in one flexible
      // column and the delete icon can be pinned to the far right instead of hugging the title.
      const wrap = document.createElement("div");
      wrap.className = "searchTitleWrap";
      wrap.appendChild(header.querySelector(".title") as HTMLElement);
      const total = document.createElement("div");
      total.className = "label";
      total.textContent = `${all.length} ${all.length === 1 ? "word" : "words"}`;
      wrap.appendChild(total);
      header.appendChild(wrap);
      if (all.length > 0) {
        const delBtn = document.createElement("button");
        delBtn.className = "iconBtn deleteBtn";
        delBtn.setAttribute("aria-label", "Select words to delete");
        delBtn.innerHTML = ICON_TRASH;
        delBtn.addEventListener("click", () => {
          selectMode = true;
          selectedWords.clear();
          renderHeader();
          renderResults();
          renderDrawer();
        });
        header.appendChild(delBtn);
      }
      headerSlot.appendChild(header);
    }
  }

  function renderChips(): void {
    chipsEl.innerHTML = "";
    const all_ = [{ topic: ALL_TOPICS, count: all.length }, ...chips];
    for (const c of all_) {
      const btn = document.createElement("button");
      btn.className = "chip" + (c.topic === searchTopic ? " active" : "");
      btn.setAttribute("aria-pressed", String(c.topic === searchTopic));
      const label = document.createElement("span");
      label.textContent = c.topic;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = String(c.count);
      btn.append(label, n);
      btn.addEventListener("click", () => {
        searchTopic = c.topic;
        renderChips();
        renderResults();
        if (selectMode) renderHeader(); // "Select all" reflects the narrowed set
      });
      chipsEl.appendChild(btn);
    }
  }

  function renderResults(): void {
    const matches = currentMatches();
    results.innerHTML = "";
    results.classList.toggle("titled", searchTopic !== ALL_TOPICS);
    if (all.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No saved words yet.";
      results.appendChild(empty);
      return;
    }
    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No words match.";
      results.appendChild(empty);
      return;
    }
    if (searchTopic !== ALL_TOPICS) {
      const title = document.createElement("div");
      title.className = "label section";
      title.textContent = `${searchTopic} · ${matches.length}`;
      results.appendChild(title);
    }
    for (const w of matches) {
      if (!selectMode) {
        results.appendChild(wordRow(w, searchQuery));
        continue;
      }
      const key = w.word.toLowerCase();
      results.appendChild(
        wordRow(w, searchQuery, {
          checked: selectedWords.has(key),
          onToggle: () => {
            if (selectedWords.has(key)) selectedWords.delete(key);
            else selectedWords.add(key);
            renderHeader();
            renderResults();
            renderDrawer();
          },
        })
      );
    }
  }

  function renderDrawer(): void {
    drawerSlot.innerHTML = "";
    drawerSlot.className = "";
    if (!selectMode) return;
    drawerSlot.className = "deleteDrawer";
    drawerSlot.innerHTML = `
      <div class="deleteDrawerWarning">Removed words can't be recovered.</div>
      <button class="deleteDrawerBtn">${ICON_TRASH}Delete from library (${selectedWords.size})</button>
      <div class="err"></div>
    `;
    const btn = drawerSlot.querySelector(".deleteDrawerBtn") as HTMLButtonElement;
    btn.disabled = selectedWords.size === 0;
    const errEl = drawerSlot.querySelector(".err") as HTMLDivElement;
    btn.addEventListener("click", async () => {
      if (selectedWords.size === 0) return;
      const count = selectedWords.size;
      errEl.textContent = "";
      btn.disabled = true;
      btn.innerHTML = "Deleting…";
      try {
        await wordStore.deleteWords([...selectedWords]);
        selectMode = false;
        selectedWords.clear();
        // no manual re-render here - the storage.onChanged listener above re-renders the whole search view
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = `${ICON_TRASH}Delete from library (${count})`;
        errEl.textContent = e instanceof Error ? e.message : "Couldn't delete those words.";
      }
    });
  }

  input.addEventListener("input", () => {
    searchQuery = input.value;
    clearBtn.hidden = !searchQuery;
    renderResults();
    if (selectMode) renderHeader();
  });
  clearBtn.addEventListener("click", () => {
    searchQuery = "";
    input.value = "";
    clearBtn.hidden = true;
    renderResults();
    if (selectMode) renderHeader();
    input.focus();
  });
  clearBtn.hidden = !searchQuery;
  renderHeader();
  renderChips();
  renderResults();
  renderDrawer();
  if (!selectMode) queueMicrotask(() => input.focus());

  return panel;
}

// Add a word: type a word, read its preview, then add it - the button appears below the preview, only once
// there is a preview to add.
function renderSave(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.appendChild(backHeader("Add a word"));

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="label section">New word</div>
    <input placeholder="Type a word..." />
    <div class="err"></div>
    <div class="preview" hidden>
      <div class="label section">Preview</div>
      <div class="pword"></div>
      <div class="ppron"></div>
      <div class="pmeaning"></div>
      <div class="pexample"></div>
    </div>
    <button class="primaryBtn" hidden>${ICON_BOOK}Add to my library</button>
  `;
  panel.appendChild(body);

  const input = body.querySelector("input") as HTMLInputElement;
  const addBtn = body.querySelector(".primaryBtn") as HTMLButtonElement;
  const errEl = body.querySelector(".err") as HTMLDivElement;
  const preview = body.querySelector(".preview") as HTMLDivElement;

  let previewWord: string | null = null;
  let previewExplanation: WordExplanation | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;

  function resetAddBtn(): void {
    addBtn.disabled = false;
    addBtn.classList.remove("saved");
    addBtn.innerHTML = `${ICON_BOOK}Add to my library`;
  }

  function showPreview(word: string, e: Pick<WordExplanation, "meaning" | "example" | "pronunciation" | "partOfSpeech">): void {
    preview.hidden = false;
    addBtn.hidden = false;
    preview.querySelector(".pword")!.textContent = word;
    preview.querySelector(".ppron")!.textContent = [e.pronunciation, e.partOfSpeech].filter(Boolean).join("  ·  ");
    preview.querySelector(".pmeaning")!.textContent = e.meaning;
    preview.querySelector(".pexample")!.textContent = e.example;
  }

  function hidePreview(): void {
    preview.hidden = true;
    addBtn.hidden = true;
  }

  async function loadPreview(): Promise<void> {
    const word = input.value.trim();
    if (word.length < 2) {
      hidePreview();
      previewWord = null;
      previewExplanation = null;
      return;
    }
    const settings = await createApiKeyStore(chrome.storage.local).getSettings();
    if (!settings) return;

    const existing = (await wordStore.getAllWords()).find((w) => w.word.toLowerCase() === word.toLowerCase());
    try {
      let explanation: WordExplanation;
      if (existing) {
        const detail = await detailCache.getDetail(existing.word);
        explanation = {
          meaning: existing.shortMeaning,
          example: detail?.example ?? "",
          pronunciation: detail?.pronunciation ?? "",
          partOfSpeech: detail?.partOfSpeech ?? "",
          topic: existing.topic ?? OTHER_TOPIC,
        };
      } else {
        explanation = await createModelClient(settings.provider, settings.key).explainWord(word);
      }
      if (input.value.trim().toLowerCase() !== word.toLowerCase()) return; // stale by the time it resolved
      previewWord = word;
      previewExplanation = explanation;
      showPreview(existing?.word ?? word, explanation);
    } catch {
      // preview is best-effort; the Add button surfaces the real error
    }
  }

  input.addEventListener("input", () => {
    hidePreview();
    resetAddBtn();
    previewWord = null;
    previewExplanation = null;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(loadPreview, 500);
  });
  input.addEventListener("blur", () => {
    if (previewTimer) clearTimeout(previewTimer);
    loadPreview();
  });

  addBtn.addEventListener("click", async () => {
    errEl.textContent = "";
    const word = input.value.trim();
    const settings = await createApiKeyStore(chrome.storage.local).getSettings();
    if (!settings) {
      errEl.textContent = "Add your API key in Options first.";
      return;
    }
    addBtn.disabled = true;
    addBtn.innerHTML = "Saving…";
    try {
      let record: CompactWordRecord;
      if (previewWord && previewExplanation && previewWord.toLowerCase() === word.toLowerCase()) {
        const existing = (await wordStore.getAllWords()).find((w) => w.word.toLowerCase() === word.toLowerCase());
        if (existing) {
          record = existing;
        } else {
          record = await wordStore.saveWord({
            word,
            shortMeaning: previewExplanation.meaning,
            savedDate: today(),
            source: "manual",
            quizStats: { seen: 0, known: 0 },
            topic: previewExplanation.topic,
          });
          await detailCache.setDetail({
            word,
            meaning: previewExplanation.meaning,
            example: previewExplanation.example,
            pronunciation: previewExplanation.pronunciation,
            partOfSpeech: previewExplanation.partOfSpeech,
            cachedAt: today(),
          });
        }
      } else {
        record = await addWord(
          { model: createModelClient(settings.provider, settings.key), wordStore, detailCache, today },
          word
        );
      }
      const detail = await detailCache.getDetail(record.word);
      showPreview(record.word, {
        meaning: record.shortMeaning,
        example: detail?.example ?? "",
        pronunciation: detail?.pronunciation ?? "",
        partOfSpeech: detail?.partOfSpeech ?? "",
      });
      addBtn.classList.add("saved");
      addBtn.innerHTML = `${ICON_CHECK_CIRCLE}Added to my library`; // stays disabled - already added, nothing more to press
      input.value = "";
      previewWord = null;
      previewExplanation = null;
    } catch (e) {
      resetAddBtn();
      errEl.textContent = e instanceof Error ? e.message : "Couldn't add that word.";
    }
  });

  queueMicrotask(() => input.focus());
  return panel;
}

render();

// Once per device, re-ask the topic of words that were all filed under "Everyday" by an earlier prompt. The words
// change in storage, which re-renders the library and Search through the onChanged listener above.
void (async () => {
  const settings = await createApiKeyStore(chrome.storage.local).getSettings();
  if (!settings) return;
  await recategoriseWords({
    model: createModelClient(settings.provider, settings.key),
    wordStore,
    flagArea: chrome.storage.local,
  }).catch(() => {});
})();
