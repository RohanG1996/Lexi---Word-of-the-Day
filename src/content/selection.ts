import { ICON_CLOSE_THIN, ICON_BOOK, ICON_CHECK_CIRCLE } from "../lib/icons";
import { ADD_WORD_MESSAGE, type AddWordResponse } from "../lib/messages";

const MIN_LEN = 2;
const MAX_LEN = 60;
const POPOVER_WIDTH = 190;
const POPOVER_HEIGHT_ESTIMATE = 116;
const GAP = 12;
// Cormorant Garamond is decorative only (falls back to Georgia if this fails
// to load on a page with a strict CSP) - unlike Material Icons, dropped
// entirely below, nothing here breaks if this link is blocked.
const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Manrope:wght@400;500&display=swap";

let host: HTMLDivElement | null = null;

function removePopover(): void {
  host?.remove();
  host = null;
}

function isEditable(node: Node | null): boolean {
  let el = node instanceof Element ? node : node?.parentElement ?? null;
  while (el) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

function injectStyles(root: ShadowRoot): void {
  const fontsLink = document.createElement("link");
  fontsLink.rel = "stylesheet";
  fontsLink.href = FONTS_HREF;

  const style = document.createElement("style");
  style.textContent = `
    .popover { position: fixed; width: ${POPOVER_WIDTH}px; box-sizing: border-box; z-index: 2147483647;
      --paper: #F7F3EA; --border: #D8D3C9; --rule: rgba(110,155,215,0.5); --margin: rgba(214,100,96,0.7); --cta: rgba(110,155,215,0.9);
      background: var(--paper); color: #171717; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,0.18);
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; }
    /* same ruled-paper look as the widget, at the original popover size: rules on a 35px pitch, red margin line down the left */
    .popover::before { content: ""; position: absolute; inset: 0; border-radius: 10px; pointer-events: none;
      background: repeating-linear-gradient(to bottom, transparent 0 34px, var(--rule) 34px 35px); }
    .popover::after { content: ""; position: absolute; top: 0; bottom: 0; left: 20px; width: 1.5px; background: var(--margin); pointer-events: none; }
    .popover > * { position: relative; }
    /* default: popover sits to the RIGHT of the selection, caret on the left edge pointing left at it */
    .caret { position: absolute; left: -6px; top: 50%; width: 10px; height: 10px; background: var(--paper);
      border-left: 1px solid var(--border); border-bottom: 1px solid var(--border); transform: translateY(-50%) rotate(45deg); }
    /* when there's no room on the right, popover sits to the LEFT of the selection instead */
    .popover.placeLeft .caret { left: auto; right: -6px; border-left: none; border-bottom: none;
      border-right: 1px solid var(--border); border-top: 1px solid var(--border); }
    .row { height: 35px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 30px; }
    .label { font-size: 9px; font-weight: 500; letter-spacing: 0.14em; color: #66615A; text-transform: uppercase; }
    .closeBtn { color: #252525; cursor: pointer; background: none; border: none; padding: 0; display: flex; }
    .closeBtn svg { width: 12px; height: 12px; }
    .word { min-height: 35px; box-sizing: border-box; display: flex; align-items: center; padding: 0 12px 0 30px; word-break: break-word;
      font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; line-height: 22px; font-weight: 500; letter-spacing: -0.01em; }
    .action { display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; width: calc(100% - 42px); height: 32px;
      margin: 2px 12px 12px 30px; font-size: 11px; font-weight: 400; color: #171717; background: var(--paper);
      border: 1.5px solid var(--cta); border-radius: 8px; cursor: pointer; font-family: inherit; white-space: nowrap; }
    .action svg { width: 14px; height: 14px; }
    .action.saved { color: #4F7053; border-color: #BCD0BD; cursor: default; }
    .action:disabled { cursor: default; opacity: 0.75; }
    .err { color: #A33333; font-size: 10px; padding: 0 12px 10px 30px; }
    .err:empty { display: none; }
  `;
  root.appendChild(fontsLink);
  root.appendChild(style);
}

function showPopover(selectedText: string, rect: DOMRect): void {
  removePopover();

  host = document.createElement("div");
  host.id = "lexi-selection-host";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  injectStyles(shadow);

  const popover = document.createElement("div");
  popover.className = "popover";

  const fitsOnRight = rect.right + GAP + POPOVER_WIDTH <= window.innerWidth - 8;
  if (fitsOnRight) {
    popover.style.left = `${rect.right + GAP}px`;
  } else {
    popover.classList.add("placeLeft");
    popover.style.left = `${Math.max(8, rect.left - GAP - POPOVER_WIDTH)}px`;
  }
  const top = rect.top + rect.height / 2 - POPOVER_HEIGHT_ESTIMATE / 2;
  popover.style.top = `${Math.min(Math.max(8, top), window.innerHeight - POPOVER_HEIGHT_ESTIMATE - 8)}px`;

  popover.innerHTML = `
    <div class="caret"></div>
    <div class="row">
      <span class="label">Selected</span>
      <button class="closeBtn" aria-label="Close">${ICON_CLOSE_THIN}</button>
    </div>
    <div class="word"></div>
    <button class="action">${ICON_BOOK}Add to my library</button>
    <div class="err"></div>
  `;
  popover.querySelector(".word")!.textContent = selectedText;
  popover.querySelector(".closeBtn")!.addEventListener("click", removePopover);

  const actionBtn = popover.querySelector(".action") as HTMLButtonElement;
  const errEl = popover.querySelector(".err") as HTMLDivElement;
  actionBtn.addEventListener("click", async () => {
    errEl.textContent = "";
    actionBtn.disabled = true;
    actionBtn.innerHTML = "Saving…";
    try {
      const response = (await chrome.runtime.sendMessage({
        type: ADD_WORD_MESSAGE,
        word: selectedText,
      })) as AddWordResponse | undefined;
      if (!response?.ok) throw new Error(response?.error ?? "Couldn't save that word.");
      actionBtn.classList.add("saved");
      actionBtn.innerHTML = `${ICON_CHECK_CIRCLE}Added to my library`;
    } catch (e) {
      console.error("Lexi: failed to save word from selection", e);
      actionBtn.disabled = false;
      actionBtn.innerHTML = `${ICON_BOOK}Add to my library`;
      errEl.textContent = e instanceof Error ? e.message : "Couldn't save that word.";
    }
  });

  shadow.appendChild(popover);
}

document.addEventListener("mouseup", (event) => {
  if (host && event.composedPath().includes(host)) return;

  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (!text || text.length < MIN_LEN || text.length > MAX_LEN) {
    removePopover();
    return;
  }
  if (!selection || selection.rangeCount === 0 || isEditable(selection.anchorNode)) return;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  showPopover(text, rect);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") removePopover();
});

window.addEventListener("scroll", removePopover, true);
