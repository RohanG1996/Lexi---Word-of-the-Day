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

const searchInput = document.getElementById("search") as HTMLInputElement;
const listEl = document.getElementById("list") as HTMLDivElement;
const newWordInput = document.getElementById("newWord") as HTMLInputElement;
const addBtn = document.getElementById("addBtn") as HTMLButtonElement;
const addErr = document.getElementById("addErr") as HTMLDivElement;
const quizBtn = document.getElementById("quizBtn") as HTMLButtonElement;
const quizEl = document.getElementById("quiz") as HTMLDivElement;

async function renderList() {
  const all = await wordStore.getAllWords();
  const matches = filterWords(all, searchInput.value);
  listEl.innerHTML = "";
  for (const w of matches) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<span class="del" data-word="${w.word}">✕</span><div class="w"></div><div class="m"></div>`;
    row.querySelector(".w")!.textContent = w.word;
    row.querySelector(".m")!.textContent = w.shortMeaning;
    row.querySelector(".del")!.addEventListener("click", async () => {
      await wordStore.deleteWord(w.word);
      renderList();
    });
    listEl.appendChild(row);
  }
}

searchInput.addEventListener("input", renderList);

addBtn.addEventListener("click", async () => {
  addErr.textContent = "";
  const apiKey = await createApiKeyStore(chrome.storage.local).getApiKey();
  if (!apiKey) {
    addErr.textContent = "Add your API key in Options first.";
    return;
  }
  try {
    await addWord({ claude: createClaudeClient(apiKey), wordStore, detailCache, today }, newWordInput.value);
    newWordInput.value = "";
    renderList();
  } catch (e) {
    addErr.textContent = e instanceof Error ? e.message : "Couldn't add that word.";
  }
});

async function renderQuiz() {
  const all = await wordStore.getAllWords();
  const next = pickNextQuizWord(all);
  quizEl.innerHTML = "";
  if (!next) {
    quizEl.textContent = "No saved words yet.";
    return;
  }
  renderQuizCard(next);
}

function renderQuizCard(w: CompactWordRecord) {
  quizEl.innerHTML = `
    <div class="w"></div>
    <button id="reveal">Reveal meaning</button>
    <div class="m" id="meaning" style="display:none"></div>
    <div id="rate" style="display:none">
      <button id="knew">Knew it</button>
      <button id="didnt">Didn't know it</button>
    </div>
  `;
  quizEl.querySelector(".w")!.textContent = w.word;
  quizEl.querySelector("#meaning")!.textContent = w.shortMeaning;

  quizEl.querySelector("#reveal")!.addEventListener("click", () => {
    (quizEl.querySelector("#meaning") as HTMLElement).style.display = "block";
    (quizEl.querySelector("#rate") as HTMLElement).style.display = "block";
  });

  const rate = async (known: boolean) => {
    await wordStore.updateQuizStats(w.word, known);
    renderQuiz();
  };
  quizEl.querySelector("#knew")!.addEventListener("click", () => rate(true));
  quizEl.querySelector("#didnt")!.addEventListener("click", () => rate(false));
}

quizBtn.addEventListener("click", renderQuiz);

renderList();
