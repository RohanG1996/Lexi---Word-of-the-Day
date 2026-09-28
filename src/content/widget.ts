import { ICON_CLOSE_THIN, ICON_MINIMIZE_THIN, ICON_BOOK, ICON_CHECK_CIRCLE } from "../lib/icons";

export interface WidgetData {
  word: string;
  meaning: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
  // Position in the daily-word sequence; the "No. 027" line is omitted without it.
  wordNumber?: number;
}

// Fonts are decorative only (fall back to Georgia / system sans if this fails
// to load on a page with a strict CSP) - unlike Material Icons, deliberately
// not used here; see icons.ts for why.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500&display=swap";

// Largest first; the word steps down until it fits the card's text column.
const WORD_SIZES = [28, 24, 21, 18];

const CSS = `
  :host { all: initial; }
  .card, .pill {
    --paper: #F7F3EA; --ink: #171717; --ink-2: #45423E; --muted: #66615A; --border: #D8D3C9;
    --rule: rgba(110,155,215,0.5); --margin: rgba(214,100,96,0.7); --cta: rgba(110,155,215,0.9); --line: #77736C;
    --serif: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --sans: 'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  /* Same footprint as the original (V0) card: 255px wide, sized to its content. */
  .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; box-sizing: border-box;
    width: 255px; display: flex; flex-direction: column;
    background: var(--paper); color: var(--ink); border: 1px solid var(--border); border-radius: 11px;
    box-shadow: 0 12px 28px rgba(0,0,0,0.14); overflow: hidden; font-family: var(--serif); }
  /* Ruled lines: one every 35px beneath the header, behind all content. */
  .card::before { content: ""; position: absolute; left: 0; right: 0; top: 58px; bottom: 0; pointer-events: none;
    background: repeating-linear-gradient(to bottom, transparent 0 34px, var(--rule) 34px 35px); }
  /* Red notebook margin, drawn over the rules and clear of the text column. */
  .card::after { content: ""; position: absolute; top: 0; bottom: 0; left: 22px; width: 1.5px; pointer-events: none; background: var(--margin); }
  .card > * { position: relative; }

  button { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
  button:focus-visible { outline: 1.5px solid var(--line); outline-offset: 3px; border-radius: 4px; }

  .head { box-sizing: border-box; height: 51px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px 0 32px;
    border-bottom: 1px solid var(--rule); font-family: var(--sans); font-size: 10px; }
  .label { margin: 0; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 500; color: #252525; }
  .date { margin: 3px 0 0; font-weight: 400; color: var(--muted); }
  .headBtns { display: flex; align-items: center; gap: 10px; }
  .minimizeBtn, .closeBtn { display: flex; color: #252525; transition: opacity .15s, transform .15s; }
  .minimizeBtn svg, .closeBtn svg { width: 14px; height: 14px; }
  .minimizeBtn:hover, .closeBtn:hover { opacity: 0.6; transform: scale(1.08); }

  .content { padding: 14px 16px 0 32px; }
  .num { margin: 0; height: 18px; line-height: 18px; text-align: right; font-family: var(--sans); font-size: 10px; letter-spacing: 0.08em; color: #4A4A4A; }
  .num:empty { display: none; }
  .word { margin: 0; font-size: 28px; line-height: 32px; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); white-space: nowrap; }
  .pron { margin: 0; height: 26px; display: flex; align-items: center; gap: 12px; font-size: 13px; letter-spacing: 0.05em; color: var(--ink-2); }
  .pron[hidden] { display: none; }
  .pos { font-style: italic; }
  .meaning { margin: 12px 0 0; font-size: 16px; line-height: 22px; font-weight: 500; letter-spacing: 0.01em; color: #242424; }
  .exampleLabel { margin: 14px 0 0; line-height: 14px; font-family: var(--sans); font-size: 10px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
  .example { margin: 8px 0 0; font-size: 14px; line-height: 20px; font-style: italic; font-weight: 500; letter-spacing: 0.02em; color: #4A4742; }

  .footer { position: relative; box-sizing: border-box; padding: 16px 16px 18px 32px; display: flex; align-items: center; justify-content: center; }
  .saveBtn { display: inline-flex; align-items: center; gap: 7px; font-family: var(--sans); font-size: 12px; font-weight: 400; color: #272727;
    background: var(--paper); border: 1.5px solid var(--cta); border-radius: 9px; padding: 9px 16px; white-space: nowrap; transition: background .15s; }
  .saveBtn:hover:not(:disabled) { background: #F1EBDD; }
  .saveBtn svg { width: 15px; height: 15px; }
  .saveBtn:disabled { cursor: default; opacity: 0.7; }
  .saveBtn.saved { cursor: default; opacity: 1; color: #5a7d5f; border-color: #bcd0bd; }
  .widgetErr { margin: 0; padding: 0 16px 12px 32px; text-align: center; font-family: var(--sans); font-size: 10px; color: #a33; }
  .widgetErr:empty { display: none; }

  .pill { position: fixed; top: 16px; right: 16px; z-index: 2147483647; background: var(--paper); border: 1px solid var(--border);
    border-radius: 999px; box-shadow: 0 6px 15px rgba(0,0,0,0.14); color: var(--ink); padding: 6px 16px; cursor: pointer; }
  .pillWord { font-family: var(--serif); font-size: 16px; font-weight: 500; line-height: 20px; }
`;

function injectStyles(root: ShadowRoot): void {
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href = FONTS_HREF;
  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(fontsLink);
  root.appendChild(style);
}

interface WidgetHandlers {
  onClose: () => void;
  onToggleCollapse: () => void;
  onSave: () => Promise<void>;
}

// Steps the word down until it fits the card's text column. Measurement returns
// 0 when the card isn't laid out yet (e.g. jsdom), in which case the largest
// size is kept.
export function fitWord(card: HTMLElement): void {
  const wordEl = card.querySelector(".word") as HTMLElement | null;
  const column = card.querySelector(".content") as HTMLElement | null;
  if (!wordEl || !column) return;
  const available = column.clientWidth - 48;
  for (const size of WORD_SIZES) {
    wordEl.style.fontSize = `${size}px`;
    wordEl.style.lineHeight = `${size}px`;
    if (!available || wordEl.getBoundingClientRect().width <= available) break;
  }
}

// "Mon, 21 Oct" regardless of the browser locale.
function formatDate(d: Date): string {
  const part = (opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", opts);
  return `${part({ weekday: "short" })}, ${d.getDate()} ${part({ month: "short" })}`;
}

export function renderWidget(root: ShadowRoot, data: WidgetData, handlers: WidgetHandlers, collapsed: boolean): void {
  root.innerHTML = "";
  injectStyles(root);

  if (collapsed) {
    const pill = document.createElement("button");
    pill.className = "pill";
    pill.innerHTML = `<span class="pillWord"></span>`;
    pill.querySelector(".pillWord")!.textContent = data.word;
    pill.addEventListener("click", handlers.onToggleCollapse);
    root.appendChild(pill);
    return;
  }

  const card = document.createElement("section");
  card.className = "card";
  card.setAttribute("aria-label", "Word of the day");
  card.innerHTML = `
    <header class="head">
      <div>
        <p class="label">Word of the day</p>
        <p class="date"></p>
      </div>
      <div class="headBtns">
        <button class="minimizeBtn" aria-label="Minimize">${ICON_MINIMIZE_THIN}</button>
        <button class="closeBtn" aria-label="Close">${ICON_CLOSE_THIN}</button>
      </div>
    </header>
    <div class="content">
      <p class="num"></p>
      <h2 class="word"></h2>
      <p class="pron"><span class="ipa"></span><span class="pos"></span></p>
      <p class="meaning"></p>
      <p class="exampleLabel">Example</p>
      <p class="example"></p>
    </div>
    <footer class="footer">
      <button class="saveBtn">${ICON_BOOK}Add to my library</button>
      <p class="widgetErr" role="alert"></p>
    </footer>
  `;
  card.querySelector(".num")!.textContent =
    data.wordNumber === undefined ? "" : `No. ${String(data.wordNumber).padStart(3, "0")}`;
  card.querySelector(".word")!.textContent = data.word;
  (card.querySelector(".pron") as HTMLElement).hidden = !data.pronunciation && !data.partOfSpeech;
  card.querySelector(".ipa")!.textContent = data.pronunciation;
  card.querySelector(".pos")!.textContent = data.partOfSpeech;
  card.querySelector(".meaning")!.textContent = data.meaning;
  card.querySelector(".example")!.textContent = data.example;
  card.querySelector(".date")!.textContent = formatDate(new Date());
  card.querySelector(".minimizeBtn")!.addEventListener("click", handlers.onToggleCollapse);
  card.querySelector(".closeBtn")!.addEventListener("click", handlers.onClose);

  const saveBtn = card.querySelector(".saveBtn") as HTMLButtonElement;
  const widgetErr = card.querySelector(".widgetErr") as HTMLElement;
  saveBtn.addEventListener("click", async () => {
    widgetErr.textContent = "";
    saveBtn.disabled = true;
    saveBtn.innerHTML = "Saving…";
    try {
      await handlers.onSave();
      saveBtn.classList.add("saved");
      saveBtn.innerHTML = `${ICON_CHECK_CIRCLE}Added to my library`;
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${ICON_BOOK}Add to my library`;
      widgetErr.textContent = e instanceof Error ? e.message : "Couldn't save that word.";
    }
  });

  root.appendChild(card);
  fitWord(card);
  // Web fonts change text widths after first paint, so measure again once they settle.
  document.fonts?.ready.then(() => card.isConnected && fitWord(card));
}

export function mountWidget(data: WidgetData, deps: { onSave: () => Promise<void> }): void {
  const host = document.createElement("div");
  host.id = "lexi-widget-host";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  let collapsed = false;
  const rerender = () =>
    renderWidget(
      shadow,
      data,
      { onClose: () => host.remove(), onToggleCollapse: toggle, onSave: deps.onSave },
      collapsed
    );
  function toggle() {
    collapsed = !collapsed;
    rerender();
  }
  rerender();
}
