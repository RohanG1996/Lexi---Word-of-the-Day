import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createClaudeClient } from "../lib/claudeClient";
import { addWord } from "../lib/addWord";
import { filterWords } from "./search";
import { pickNextQuizWord } from "./quiz";
import type { CompactWordRecord } from "../lib/types";

const wordStore = createWordStore(chrome.storage.sync);
const detailCache = createDetailCache(chrome.storage.local);
const today = () => new Date().toISOString().slice(0, 10);

type View = "library" | "search" | "save" | "allWords" | "quiz";

let view: View = "library";
let searchQuery = "";

const app = document.getElementById("app") as HTMLDivElement;

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

function wordRow(w: CompactWordRecord): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div><div class="word"></div><div class="meaning"></div></div>
    <button class="del material-icons" aria-label="Remove ${w.word}">close</button>
  `;
  row.querySelector(".word")!.textContent = w.word;
  row.querySelector(".meaning")!.textContent = w.shortMeaning;
  row.querySelector(".del")!.addEventListener("click", async () => {
    await wordStore.deleteWord(w.word);
    render();
  });
  return row;
}

function backHeader(title: string): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "subHeader";
  header.innerHTML = `
    <button class="iconBtn back" aria-label="Back"><span class="material-icons">arrow_back</span></button>
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
    <div class="stamp"><span class="material-icons">local_library</span></div>
    <div class="who">
      <div class="name">Your Library</div>
      <div class="label"></div>
    </div>
    <button class="iconBtn" aria-label="View all saved words"><span class="material-icons">format_list_bulleted</span></button>
  `;
  header.querySelector(".label")!.textContent = `${weekWords.length} saved this week`;
  header.querySelector(".iconBtn")!.addEventListener("click", () => goTo("allWords"));
  panel.appendChild(header);

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "label section";
  sectionLabel.textContent = "This week";
  panel.appendChild(sectionLabel);

  const list = document.createElement("div");
  list.className = "list";
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
    <button class="pillBtn searchBtn"><span class="material-icons">search</span>Search</button>
    <button class="pillBtn saveBtn"><span class="material-icons">add</span>Save a word</button>
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
    <input placeholder="Search your words..." />
    <div class="label section" style="margin-left:0;"></div>
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
    <div class="label section" style="margin-left:0;">New word</div>
    <input placeholder="Type a word..." />
    <button class="primaryBtn"><span class="material-icons">auto_stories</span>Add to my library</button>
    <div class="err"></div>
    <div class="preview" hidden>
      <div class="label section" style="margin-left:0;">Preview</div>
      <div class="pword"></div>
      <div class="pmeaning"></div>
      <div class="pexample"></div>
    </div>
  `;
  panel.appendChild(body);

  const input = body.querySelector("input") as HTMLInputElement;
  const addBtn = body.querySelector(".primaryBtn") as HTMLButtonElement;
  const errEl = body.querySelector(".err") as HTMLDivElement;
  const preview = body.querySelector(".preview") as HTMLDivElement;

  addBtn.addEventListener("click", async () => {
    errEl.textContent = "";
    const apiKey = await createApiKeyStore(chrome.storage.local).getApiKey();
    if (!apiKey) {
      errEl.textContent = "Add your API key in Options first.";
      return;
    }
    try {
      const record = await addWord(
        { claude: createClaudeClient(apiKey), wordStore, detailCache, today },
        input.value
      );
      const detail = await detailCache.getDetail(record.word);
      preview.hidden = false;
      preview.querySelector(".pword")!.textContent = record.word;
      preview.querySelector(".pmeaning")!.textContent = record.shortMeaning;
      preview.querySelector(".pexample")!.textContent = detail?.example ?? "";
      input.value = "";
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
      label.style.margin = "0 0 8px";
      label.textContent = "This week";
      body.appendChild(label);
      for (const w of week) body.appendChild(wordRow(w));
    }
    if (earlier.length > 0) {
      const label = document.createElement("div");
      label.className = "label";
      label.style.margin = week.length > 0 ? "16px 0 8px" : "0 0 8px";
      label.textContent = "Earlier";
      body.appendChild(label);
      for (const w of earlier) body.appendChild(wordRow(w));
    }
  }

  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML = `<button class="pillBtn quizBtn"><span class="material-icons">school</span>Quiz me</button>`;
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
