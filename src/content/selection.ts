import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createClaudeClient } from "../lib/claudeClient";
import { addWord } from "../lib/addWord";

const MIN_LEN = 2;
const MAX_LEN = 60;
const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Manrope:wght@500;600&display=swap";
const ICONS_HREF = "https://fonts.googleapis.com/css2?family=Material+Icons";

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
  const iconsLink = document.createElement("link");
  iconsLink.rel = "stylesheet";
  iconsLink.href = ICONS_HREF;

  const style = document.createElement("style");
  style.textContent = `
    .material-icons { font-family:'Material Icons'; font-weight:normal; font-style:normal; display:inline-block; line-height:1; -webkit-font-smoothing:antialiased; }
    .popover { position: fixed; width: 178px; background: #F4EDE1; border: 1px solid #e4d9bd; border-radius: 10px;
      box-shadow: 0 10px 24px rgba(43,38,20,0.20); padding: 10px 12px; box-sizing: border-box; color: #2b2822;
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; z-index: 2147483647; }
    .caret { position: absolute; bottom: -6px; left: 20px; width: 10px; height: 10px; background: #F4EDE1;
      border-right: 1px solid #e4d9bd; border-bottom: 1px solid #e4d9bd; transform: rotate(45deg); }
    .row { display: flex; align-items: center; justify-content: space-between; margin: 0 -12px 8px; padding: 0 12px 7px; border-bottom: 1px dashed #E2B4AD; }
    .label { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 8px; letter-spacing: 0.08em; color: #8a7f63; text-transform: uppercase; }
    .closeBtn { font-size: 12px; color: #9c9174; cursor: pointer; background: none; border: none; padding: 0; }
    .word { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; font-weight: 700; margin-bottom: 8px; word-break: break-word; }
    .action { width: 100%; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px; font-weight: 600;
      color: #fff; background: #8a7f63; border: 1px solid #8a7f63; padding: 7px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; }
    .action.saved { color: #5a7d5f; background: transparent; border-color: #bcd0bd; cursor: default; }
    .err { color: #a33; font-size: 10px; margin-top: 6px; }
  `;
  root.appendChild(fontsLink);
  root.appendChild(iconsLink);
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
  popover.style.top = `${Math.max(8, rect.top - 96)}px`;
  popover.style.left = `${Math.max(8, rect.left)}px`;
  popover.innerHTML = `
    <div class="caret"></div>
    <div class="row">
      <span class="label">Selected</span>
      <button class="closeBtn material-icons" aria-label="Close">close</button>
    </div>
    <div class="word"></div>
    <button class="action"><span class="material-icons" style="font-size:13px">auto_stories</span>Add to my library</button>
    <div class="err"></div>
  `;
  popover.querySelector(".word")!.textContent = selectedText;
  popover.querySelector(".closeBtn")!.addEventListener("click", removePopover);

  const actionBtn = popover.querySelector(".action") as HTMLButtonElement;
  const errEl = popover.querySelector(".err") as HTMLDivElement;
  actionBtn.addEventListener("click", async () => {
    errEl.textContent = "";
    const apiKey = await createApiKeyStore(chrome.storage.local).getApiKey();
    if (!apiKey) {
      errEl.textContent = "Add your API key in Options first.";
      return;
    }
    try {
      await addWord(
        {
          claude: createClaudeClient(apiKey),
          wordStore: createWordStore(chrome.storage.sync),
          detailCache: createDetailCache(chrome.storage.local),
          today: () => new Date().toISOString().slice(0, 10),
        },
        selectedText
      );
      actionBtn.classList.add("saved");
      actionBtn.innerHTML = `<span class="material-icons" style="font-size:13px">check_circle</span>Saved to your library`;
    } catch (e) {
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
