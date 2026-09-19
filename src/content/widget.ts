export interface WidgetData {
  word: string;
  meaning: string;
  example: string;
}

export function renderWidget(root: ShadowRoot, data: WidgetData, onClose: () => void): void {
  root.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
    .card { position: fixed; top: 16px; right: 16px; width: 260px; background: #fff; color: #1a1a1a;
      border: 1px solid #ddd; border-radius: 12px; padding: 16px; font-family: sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 2147483647; }
    .word { font-weight: 600; font-size: 16px; margin: 0 0 4px; }
    .meaning { font-size: 13px; margin: 0 0 8px; color: #333; }
    .example { font-size: 12px; font-style: italic; color: #555; margin: 0; }
    .close { position: absolute; top: 8px; right: 10px; cursor: pointer; border: none; background: none; font-size: 14px; }
  `;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <p class="word"></p>
    <p class="meaning"></p>
    <p class="example"></p>
  `;
  card.querySelector(".word")!.textContent = data.word;
  card.querySelector(".meaning")!.textContent = data.meaning;
  card.querySelector(".example")!.textContent = data.example;
  card.querySelector(".close")!.addEventListener("click", onClose);

  root.appendChild(style);
  root.appendChild(card);
}

export function mountWidget(data: WidgetData): void {
  const host = document.createElement("div");
  host.id = "lexi-widget-host";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  renderWidget(shadow, data, () => host.remove());
}
