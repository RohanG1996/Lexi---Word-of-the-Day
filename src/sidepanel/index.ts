import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createModelClient } from "../lib/modelClient";
import { addWord } from "../lib/addWord";
import { filterWords } from "./search";
import { pickNextQuizWord } from "./quiz";
import type { CompactWordRecord } from "../lib/types";
import {
  ICON_BOOK,
  ICON_BACK,
  ICON_LIST,
  ICON_SEARCH,
  ICON_PLUS,
  ICON_SCHOOL,
  ICON_SETTINGS,
  ICON_CHEVRON_DOWN,
} from "../lib/icons";

const wordStore = createWordStore(chrome.storage.sync);
const detailCache = createDetailCache(chrome.storage.local);
const today = () => new Date().toISOString().slice(0, 10);

type View = "library" | "search" | "save" | "allWords" | "quiz";

let view: View = "library";
let searchQuery = "";

const app = document.getElementById("app") as HTMLDivElement;

// Saving a word from the content-script highlight popover (or the widget)
// writes to this same chrome.storage.sync key from a different context - keep
// the library/search/all-words views live instead of requiring a re-open.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes["lexi.words"]) return;
  if (view === "library" || view === "allWords" || view === "search") render();
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
  else if (view === "save") app.appendChild(renderSave());
  else if (view === "allWords") app.appendChild(renderAllWords(all));
  else app.appendChild(renderQuiz(all));
}

function goTo(next: View): void {
  view = next;
  render();
}

// A saved word is an accordion: one click on the row shows the pronunciation, full meaning and example (read
// lazily from the local detail cache, falling back to the short meaning). Opening one row closes any other.
function wordRow(w: CompactWordRecord): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <button class="rowHead" aria-expanded="false">
      <div class="rowText"><div class="word"></div><div class="meaning"></div></div>
      <span class="chev" aria-hidden="true">${ICON_CHEVRON_DOWN}</span>
    </button>
    <div class="rowBody" hidden></div>
  `;
  row.querySelector(".word")!.textContent = w.word;
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
      <button class="iconBtn allBtn" aria-label="View all saved words">${ICON_LIST}</button>
      <button class="iconBtn settingsBtn" aria-label="Settings">${ICON_SETTINGS}</button>
    </div>
  `;
  header.querySelector(".label")!.textContent = `${weekWords.length} saved this week`;
  header.querySelector(".allBtn")!.addEventListener("click", () => goTo("allWords"));
  header.querySelector(".settingsBtn")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
  panel.appendChild(header);

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "label section";
  sectionLabel.textContent = "This week";

  // the section label lives inside the scrolling list so it sits on the same ruled grid as the rows
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
    <button class="pillBtn saveBtn">${ICON_PLUS}Save a word</button>
  `;
  footer.querySelector(".searchBtn")!.addEventListener("click", () => {
    searchQuery = "";
    goTo("search");
  });
  footer.querySelector(".saveBtn")!.addEventListener("click", () => goTo("save"));
  panel.appendChild(footer);

  return panel;
}

function renderSearch(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.appendChild(backHeader("Search your words"));

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <input class="tall" placeholder="Search your words..." />
    <div class="label section"></div>
    <div class="list"></div>
  `;
  panel.appendChild(body);

  const input = body.querySelector("input") as HTMLInputElement;
  const countLabel = body.querySelector(".label") as HTMLDivElement;
  const list = body.querySelector(".list") as HTMLDivElement;
  input.value = searchQuery;

  function renderMatches(): void {
    const matches = filterWords(all, input.value);
    countLabel.textContent = matches.length === 1 ? "1 match" : `${matches.length} matches`;
    list.innerHTML = "";
    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No words match.";
      list.appendChild(empty);
      return;
    }
    for (const w of matches) list.appendChild(wordRow(w));
  }

  input.addEventListener("input", () => {
    searchQuery = input.value;
    renderMatches();
  });
  renderMatches();
  queueMicrotask(() => input.focus());

  return panel;
}

function renderSave(): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.appendChild(backHeader("Add a word"));

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="label section">New word</div>
    <input placeholder="Type a word..." />
    <button class="primaryBtn">${ICON_BOOK}Add to my library</button>
    <div class="err"></div>
    <div class="success" hidden></div>
    <div class="preview" hidden>
      <div class="label section">Preview</div>
      <div class="pword"></div>
      <div class="ppron"></div>
      <div class="pmeaning"></div>
      <div class="pexample"></div>
    </div>
  `;
  panel.appendChild(body);

  const input = body.querySelector("input") as HTMLInputElement;
  const addBtn = body.querySelector(".primaryBtn") as HTMLButtonElement;
  const errEl = body.querySelector(".err") as HTMLDivElement;
  const successEl = body.querySelector(".success") as HTMLDivElement;
  const preview = body.querySelector(".preview") as HTMLDivElement;

  let previewWord: string | null = null;
  let previewExplanation: { meaning: string; example: string; pronunciation: string; partOfSpeech: string } | null =
    null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;

  function showPreview(word: string, e: { meaning: string; example: string; pronunciation: string; partOfSpeech: string }): void {
    preview.hidden = false;
    preview.querySelector(".pword")!.textContent = word;
    preview.querySelector(".ppron")!.textContent = [e.pronunciation, e.partOfSpeech].filter(Boolean).join("  ·  ");
    preview.querySelector(".pmeaning")!.textContent = e.meaning;
    preview.querySelector(".pexample")!.textContent = e.example;
  }

  async function loadPreview(): Promise<void> {
    const word = input.value.trim();
    if (word.length < 2) {
      preview.hidden = true;
      previewWord = null;
      previewExplanation = null;
      return;
    }
    const settings = await createApiKeyStore(chrome.storage.local).getSettings();
    if (!settings) return;

    const existing = (await wordStore.getAllWords()).find((w) => w.word.toLowerCase() === word.toLowerCase());
    try {
      let explanation: { meaning: string; example: string; pronunciation: string; partOfSpeech: string };
      if (existing) {
        const detail = await detailCache.getDetail(existing.word);
        explanation = {
          meaning: existing.shortMeaning,
          example: detail?.example ?? "",
          pronunciation: detail?.pronunciation ?? "",
          partOfSpeech: detail?.partOfSpeech ?? "",
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
    preview.hidden = true;
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

function renderAllWords(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";

  const header = backHeader("All saved words");
  const total = document.createElement("div");
  total.className = "label";
  total.style.marginLeft = "auto";
  total.textContent = `${all.length} total`;
  header.appendChild(total);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.className = "body";
  panel.appendChild(body);

  if (all.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No saved words yet.";
    body.appendChild(empty);
  } else {
    const week = all.filter(isThisWeek);
    const earlier = all.filter((w) => !isThisWeek(w));

    if (week.length > 0) {
      const label = document.createElement("div");
      label.className = "label";
      label.className = "label section";
      label.textContent = "This week";
      body.appendChild(label);
      for (const w of week) body.appendChild(wordRow(w));
    }
    if (earlier.length > 0) {
      const label = document.createElement("div");
      label.className = "label";
      label.className = "label section";
      label.textContent = "Earlier";
      body.appendChild(label);
      for (const w of earlier) body.appendChild(wordRow(w));
    }
  }

  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = `<button class="pillBtn quizBtn">${ICON_SCHOOL}Quiz me</button>`;
  footer.querySelector(".quizBtn")!.addEventListener("click", () => goTo("quiz"));
  panel.appendChild(footer);

  return panel;
}

function renderQuiz(all: CompactWordRecord[]): HTMLDivElement {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.appendChild(backHeader("Quiz me"));

  const body = document.createElement("div");
  body.className = "body";
  panel.appendChild(body);

  const next = pickNextQuizWord(all);
  if (!next) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No saved words yet.";
    body.appendChild(empty);
    return panel;
  }

  const card = document.createElement("div");
  card.className = "quizCard";
  card.innerHTML = `
    <div class="label section prompt">Do you know this word?</div>
    <div class="word"></div>
    <button class="pillBtn revealBtn">Reveal meaning</button>
    <div class="meaning" hidden></div>
    <div class="quizActions" hidden>
      <button class="pillBtn knewBtn">Knew it</button>
      <button class="pillBtn didntBtn">Didn't know it</button>
    </div>
  `;
  card.querySelector(".word")!.textContent = next.word;
  const meaningEl = card.querySelector(".meaning") as HTMLDivElement;
  meaningEl.textContent = next.shortMeaning;
  const actions = card.querySelector(".quizActions") as HTMLDivElement;
  const revealBtn = card.querySelector(".revealBtn") as HTMLButtonElement;

  revealBtn.addEventListener("click", () => {
    meaningEl.hidden = false;
    actions.hidden = false;
    revealBtn.hidden = true;
  });

  const rate = async (known: boolean) => {
    await wordStore.updateQuizStats(next.word, known);
    render();
  };
  card.querySelector(".knewBtn")!.addEventListener("click", () => rate(true));
  card.querySelector(".didntBtn")!.addEventListener("click", () => rate(false));

  body.appendChild(card);
  return panel;
}

render();
