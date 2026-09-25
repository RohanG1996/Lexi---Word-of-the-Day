export interface WidgetData {
  word: string;
  meaning: string;
  example: string;
}

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;500;600;700&display=swap";
const ICONS_HREF = "https://fonts.googleapis.com/css2?family=Material+Icons";

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
    .card { position: fixed; top: 16px; right: 16px; width: 255px; background: #F4EDE1; color: #2b2822;
      border: 1px solid #e4d9bd; border-radius: 11px; box-shadow: 0 12px 28px rgba(43,38,20,0.16);
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; z-index: 2147483647; overflow: hidden; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 14px 9px; border-bottom: 1px dashed #E2B4AD; }
    .label { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 9px; letter-spacing: 0.1em; color: #8a7f63; text-transform: uppercase; }
    .date { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 8px; color: #8a7f63; margin-top: 3px; }
    .headBtns { display: flex; align-items: center; gap: 9px; }
    .minimizeBtn { font-size: 12px; color: #9c9174; cursor: pointer; }
    .closeBtn { font-size: 10px; color: #9c9174; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; }
    .word { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 700; margin: 0; padding: 14px 14px 11px; }
    .meaning { font-size: 12px; line-height: 1.55; margin: 0; padding: 11px 14px; border-top: 1px dashed #E2B4AD; }
    .exampleLabel { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 9px; letter-spacing: 0.1em; color: #8a7f63; text-transform: uppercase; margin: 0; padding: 11px 14px 6px; border-top: 1px dashed #E2B4AD; }
    .example { font-size: 11px; font-style: italic; line-height: 1.5; color: #3a362c; margin: 0; padding: 0 14px 11px; }
    .footer { display: flex; align-items: center; justify-content: center; padding: 11px 14px 14px; border-top: 1px dashed #E2B4AD; }
    .saveBtn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; font-weight: 600; color: #6b6350;
      background: #F4EDE1; border: 1px solid #ddd0ae; padding: 7px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; }
    .pill { position: fixed; top: 16px; right: 16px; background: #F4EDE1; border: 1px solid #e4d9bd; border-radius: 999px;
      box-shadow: 0 6px 15px rgba(43,38,20,0.14); color: #2b2822; padding: 6px 14px; display: flex; align-items: center; cursor: pointer;
      font-family: 'Manrope', -apple-system, Segoe UI, Roboto, sans-serif; z-index: 2147483647; border-width: 1px; }
    .pillWord { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 14px; font-weight: 700; }
  `;
  root.appendChild(fontsLink);
  root.appendChild(iconsLink);
  root.appendChild(style);
}

interface WidgetHandlers {
  onClose: () => void;
  onToggleCollapse: () => void;
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
        <p class="label" style="margin:0;">Word of the day</p>
        <p class="date" style="margin:0;"></p>
      </div>
      <div class="headBtns">
        <span class="material-icons minimizeBtn" aria-label="Minimize">remove</span>
        <button class="closeBtn" aria-label="Close">✕</button>
      </div>
    </div>
    <p class="word"></p>
    <p class="meaning"></p>
    <p class="exampleLabel">Example</p>
    <p class="example"></p>
    <div class="footer">
      <button class="saveBtn"><span class="material-icons" style="font-size:12px">bookmark</span>Save to my library</button>
    </div>
  `;
  card.querySelector(".word")!.textContent = data.word;
  card.querySelector(".meaning")!.textContent = data.meaning;
  card.querySelector(".example")!.textContent = data.example;
  card.querySelector(".date")!.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  card.querySelector(".minimizeBtn")!.addEventListener("click", handlers.onToggleCollapse);
  card.querySelector(".closeBtn")!.addEventListener("click", handlers.onClose);

  root.appendChild(card);
}

export function mountWidget(data: WidgetData): void {
  const host = document.createElement("div");
  host.id = "lexi-widget-host";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);

  let collapsed = false;
  const rerender = () =>
    renderWidget(shadow, data, { onClose: () => host.remove(), onToggleCollapse: toggle }, collapsed);
  function toggle() {
    collapsed = !collapsed;
    rerender();
  }
  rerender();
}
