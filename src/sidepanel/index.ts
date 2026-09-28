import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createModelClient } from "../lib/modelClient";
import { addWord } from "../lib/addWord";
import { OTHER_TOPIC, type WordExplanation } from "../lib/prompts";
import { ALL_TOPICS, searchWords, topicChips } from "./search";
import type { CompactWordRecord } from "../lib/types";
import {
  ICON_BOOK,
  ICON_BACK,
  ICON_SEARCH,
  ICON_PLUS,
  ICON_SETTINGS,
  ICON_CHEVRON_DOWN,
  ICON_CLOSE_THIN,
} from "../lib/icons";

const wordStore = createWordStore(chrome.storage.sync);
const detailCache = createDetailCache(chrome.storage.local);
const today = () => new Date().toISOString().slice(0, 10);

// Library -> Search (search + browsing by topic, replacing the old "All saved words" list) or Add a word.
type View = "library" | "search" | "save";

let view: View = "library";
let searchQuery = "";
let searchTopic = ALL_TOPICS;

const app = document.getElementById("app") as HTMLDivElement;

// Saving a word from the content-script highlight popover (or the widget)
// writes to this same chrome.storage.sync key from a different context - keep
// the library and search views live instead of requiring a re-open.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes["lexi.words"]) return;
  if (view === "library" || view === "search") render();
});

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function isThisWeek(record: CompactWordRecord): boolean {
  return new Date(record.savedDate) >= daysAgo(7);
}

async function render(): Promise<void> {
  const all = await wordStore.getAllWords();
  app.innerHTML = "";
  if (view === "library") app.appendChild(renderLibrary(all));
  else if (view === "search") app.appendChild(renderSearch(all));
  else app.appendChild(renderSave());
}

function goTo(next: View): void {
  view = next;
  render();
}

// A saved word is an accordion: one click on the row shows the pronunciation, full meaning and example (read
// lazily from the local detail cache, falling back to the short meaning). Opening one row closes any other.
function wordRow(w: CompactWordRecord, highlight = ""): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
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
        (other.querySelector(".rowBody") as HTMLElement).hidden = true;
      }
      if (!loaded) {
        loaded = true;
        await fillBody();
      }
    }
    row.classList.toggle("open", opening);
    head.setAttribute("aria-expanded", String(opening));
    body.hidden = !opening;
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

function renderLibrary(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";

  const weekWords = all.filter(isThisWeek);

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
  header.querySelector(".label")!.textContent = `${weekWords.length} saved this week`;
  header.querySelector(".settingsBtn")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
  panel.appendChild(header);

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
function renderSearch(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";

  const header = backHeader("Search");
  const total = document.createElement("div");
  total.className = "label";
  total.textContent = `${all.length} ${all.length === 1 ? "word" : "words"}`;
  header.appendChild(total);
  panel.appendChild(header);

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

  const input = body.querySelector(".sInput") as HTMLInputElement;
  const clearBtn = body.querySelector(".clearBtn") as HTMLButtonElement;
  const chipsEl = body.querySelector(".chips") as HTMLDivElement;
  const results = body.querySelector(".results") as HTMLDivElement;
  input.value = searchQuery;

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
      });
      chipsEl.appendChild(btn);
    }
  }

  function renderResults(): void {
    const matches = searchWords(all, searchQuery, searchTopic);
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
    for (const w of matches) results.appendChild(wordRow(w, searchQuery));
  }

  input.addEventListener("input", () => {
    searchQuery = input.value;
    clearBtn.hidden = !searchQuery;
    renderResults();
  });
  clearBtn.addEventListener("click", () => {
    searchQuery = "";
    input.value = "";
    clearBtn.hidden = true;
    renderResults();
    input.focus();
  });
  clearBtn.hidden = !searchQuery;
  renderChips();
  renderResults();
  queueMicrotask(() => input.focus());

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
    <div class="success" hidden></div>
  `;
  panel.appendChild(body);

  const input = body.querySelector("input") as HTMLInputElement;
  const addBtn = body.querySelector(".primaryBtn") as HTMLButtonElement;
  const errEl = body.querySelector(".err") as HTMLDivElement;
  const successEl = body.querySelector(".success") as HTMLDivElement;
  const preview = body.querySelector(".preview") as HTMLDivElement;

  let previewWord: string | null = null;
  let previewExplanation: WordExplanation | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;

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
    successEl.hidden = true;
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
    successEl.hidden = true;
    const word = input.value.trim();
    const settings = await createApiKeyStore(chrome.storage.local).getSettings();
    if (!settings) {
      errEl.textContent = "Add your API key in Options first.";
      return;
    }
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
      addBtn.hidden = true; // already added - nothing more to press
      successEl.hidden = false;
      successEl.textContent = `${record.word} — added to your library`;
      input.value = "";
      previewWord = null;
      previewExplanation = null;
    } catch (e) {
      errEl.textContent = e instanceof Error ? e.message : "Couldn't add that word.";
    }
  });

  queueMicrotask(() => input.focus());
  return panel;
}

render();
