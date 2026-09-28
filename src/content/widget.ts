import { ICON_MINIMIZE, ICON_BOOK, ICON_CHECK_CIRCLE } from "../lib/icons";

export interface WidgetData {
  word: string;
  meaning: string;
  example: string;
  pronunciation: string;
  partOfSpeech: string;
}

// Ruled-paper grid: every rule sits on a 35px step, and body text uses a
// half-step (17.5px) line height so two text lines fill exactly one step.
export const GRID_STEP = 35;
export const TEXT_LINE = 17.5;

// Cormorant Garamond/Manrope are decorative only (fall back to Georgia/system
// sans if this fails to load on a page with a strict CSP) - unlike Material
// Icons, deliberately not used here; see icons.ts for why.
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap";

const DASH_MASK = "repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 7px)";

function injectStyles(root: ShadowRoot): void {
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href = FONTS_HREF;

  const style = document.createElement("style");
  style.textContent = `
    .card { position: fixed; top: 16px; right: 16px; width: 255px; background: #F4EDE1; color: #2b2822;
      border: 1px solid #e4d9bd; border-radius: 11px; box-shadow: 0 12px 28px rgba(43,38,20,0.16);
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; z-index: 2147483647; overflow: hidden; }
    .mono { font-family: ui-monospace, 'SF Mono', Consolas, monospace; }

    .head { position: relative; box-sizing: border-box; height: 50px; display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 14px 0; }
    .head::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: #E2B4AD;
      -webkit-mask-image: ${DASH_MASK}; mask-image: ${DASH_MASK}; }
    .label { font-size: 9px; line-height: 12px; letter-spacing: 0.1em; color: #8a7f63; text-transform: uppercase; margin: 0; }
    .date { font-size: 8px; line-height: 10px; color: #8a7f63; margin: 5px 0 0; }
    .headBtns { display: flex; align-items: center; gap: 9px; }
    .minimizeBtn { color: #9c9174; cursor: pointer; background: none; border: none; padding: 0; display: flex; }
    .closeBtn { font-size: 10px; color: #9c9174; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; }

    .body { position: relative; }
    .body::before { content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: ${GRID_STEP}px; pointer-events: none;
      background: repeating-linear-gradient(to bottom, transparent 0 ${GRID_STEP - 1}px, #E2B4AD ${GRID_STEP - 1}px ${GRID_STEP}px);
      -webkit-mask-image: ${DASH_MASK}; mask-image: ${DASH_MASK}; }

    .row { position: relative; box-sizing: border-box; height: ${GRID_STEP}px; margin: 0; padding: 0 14px; display: flex; align-items: center; }
    .row[hidden] { display: none; }
    .row.multi { align-items: flex-end; }
    .row.multi .blk { position: relative; top: 8.25px; }
    .txt { background: #F4EDE1; padding: 0 6px 0 0; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
    .blk { display: block; min-width: 0; line-height: ${TEXT_LINE}px; }

    .wordRow { align-items: flex-end; }
    .word { position: relative; top: 13.5px; background: #F4EDE1; padding-right: 6px; white-space: nowrap;
      font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 700; line-height: 32px; }
    .pron { padding-top: 8px; font-size: 10px; color: #7d735a; }
    .pron .pos { font-style: italic; margin-left: 8px; }
    .meaning { font-size: 12px; }
    .exampleLabel { align-items: flex-end; padding-bottom: 6px; font-size: 9px; letter-spacing: 0.1em; color: #8a7f63; text-transform: uppercase; }
    .example { font-size: 11px; font-style: italic; color: #3a362c; }

    .footer { position: relative; box-sizing: border-box; height: ${GRID_STEP * 2}px; display: flex; align-items: flex-start; justify-content: center; padding: 25px 14px 0; }
    .saveBtn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; font-weight: 600; color: #6b6350;
      background: #F4EDE1; border: 1px solid #ddd0ae; padding: 7px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .saveBtn.saved { color: #5a7d5f; border-color: #bcd0bd; cursor: default; }
    .saveBtn:disabled { cursor: default; opacity: 0.7; }
    .widgetErr { color: #a33; font-size: 10px; text-align: center; margin: 0; padding: 0 14px 12px; }
    .widgetErr:empty { display: none; }

    .pill { position: fixed; top: 16px; right: 16px; background: #F4EDE1; border: 1px solid #e4d9bd; border-radius: 999px;
      box-shadow: 0 8px 20px rgba(43,38,20,0.28); color: #2b2822; padding: 10px 22px; display: flex; align-items: center; cursor: pointer;
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; z-index: 2147483647; }
    .pillWord { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 700; line-height: 28px; }
  `;
  root.appendChild(fontsLink);
  root.appendChild(style);
}

interface WidgetHandlers {
  onClose: () => void;
  onToggleCollapse: () => void;
  onSave: () => Promise<void>;
}

// Rows grow in whole grid steps so the rules never move, and the last line of
// multi-line text sits on a rule. Measurement returns 0 when the card isn't
// laid out yet (e.g. jsdom), in which case everything stays single-step.
export function snapCardLayout(card: HTMLElement): void {
  const wordEl = card.querySelector(".word") as HTMLElement | null;
  const wordRow = card.querySelector(".wordRow") as HTMLElement | null;
  if (wordEl && wordRow) {
    const available = wordRow.clientWidth - 28;
    for (const size of [26, 22, 19]) {
      wordEl.style.fontSize = `${size}px`;
      if (!available || wordEl.getBoundingClientRect().width <= available) break;
    }
  }

  card.querySelectorAll<HTMLElement>(".row[data-snap]").forEach((row) => {
    const blk = row.querySelector(".blk") as HTMLElement | null;
    const height = blk?.getBoundingClientRect().height ?? 0;
    const lines = Math.round(height / TEXT_LINE);
    row.classList.toggle("multi", lines > 1);
    row.style.height = `${Math.max(1, Math.ceil((lines * TEXT_LINE) / GRID_STEP)) * GRID_STEP}px`;
  });
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

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="head">
      <div>
        <p class="label mono">Word of the day</p>
        <p class="date mono"></p>
      </div>
      <div class="headBtns">
        <button class="minimizeBtn" aria-label="Minimize">${ICON_MINIMIZE}</button>
        <button class="closeBtn" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="body">
      <div class="row wordRow"><span class="word"></span></div>
      <p class="row pron mono"><span class="txt"><span class="ipa"></span><span class="pos"></span></span></p>
      <p class="row meaning" data-snap><span class="blk"><span class="txt meaningText"></span></span></p>
      <p class="row exampleLabel mono"><span class="txt">Example</span></p>
      <p class="row example" data-snap><span class="blk"><span class="txt exampleText"></span></span></p>
      <div class="footer">
        <button class="saveBtn">${ICON_BOOK}Add to my library</button>
      </div>
    </div>
    <p class="widgetErr"></p>
  `;
  card.querySelector(".word")!.textContent = data.word;
  (card.querySelector(".pron") as HTMLElement).hidden = !data.pronunciation && !data.partOfSpeech;
  card.querySelector(".ipa")!.textContent = data.pronunciation;
  card.querySelector(".pos")!.textContent = data.partOfSpeech;
  card.querySelector(".meaningText")!.textContent = data.meaning;
  card.querySelector(".exampleText")!.textContent = data.example;
  card.querySelector(".date")!.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
  snapCardLayout(card);
  // Web fonts change text widths after first paint, so measure again once they settle.
  document.fonts?.ready.then(() => card.isConnected && snapCardLayout(card));
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
