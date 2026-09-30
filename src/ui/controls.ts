// Form controls shared by the onboarding pop-up (a Shadow DOM in the host page) and the side panel's Settings view,
// so both look and behave the same: a dropdown, the goal picker, and the "Which industry?" field. Everything is
// scoped under the `.lx` class (which also defines the colour/type variables), so drop the class on any container
// and add CONTROLS_CSS to its stylesheet. All user-facing text is set with textContent, never innerHTML.

import { GOALS, INDUSTRY_SUGGESTIONS, needsIndustry, type GoalId } from "../lib/profile";

const CHEVRON = (points: string) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="${points}"/></svg>`;
export const ICON_CHEV_DOWN = CHEVRON("6,9 12,15 18,9");
export const ICON_CHEV_UP = CHEVRON("6,15 12,9 18,15");
export const ICON_CLOCK = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.5,14"/></svg>`;
const TICK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,12.5 9.5,18 20,6.5"/></svg>`;

export const CONTROLS_CSS = `
  .lx {
    --paper: #F7F3EA; --ink: #171717; --ink-2: #45423E; --muted: #66615A; --border: #D8D3C9;
    --rule: rgba(110,155,215,0.3); --cta: rgba(110,155,215,0.9); --btn: #EDE6D4; --chip-on: #D9CFB2; --radio: #C9C2B0;
    --serif: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --sans: 'Manrope', -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .lx .lx-label { display: block; font: 500 11px/1.2 var(--sans); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
  .lx .lx-help { margin-top: 8px; font: 400 12px/16px var(--sans); color: var(--muted); }

  .lx .lx-field { display: block; width: 100%; height: 46px; box-sizing: border-box; padding: 0 14px; margin: 0;
    font: 400 15px var(--sans); color: var(--ink); background: #fff; border: 1.5px solid var(--cta); border-radius: 10px; }
  .lx .lx-field::placeholder { color: var(--muted); }
  .lx .lx-field:focus { outline: none; box-shadow: 0 0 0 2px rgba(110,155,215,0.25); }

  /* dropdown: the trigger shows the current value; the list drops down attached to it */
  .lx .lx-dd { position: relative; }
  .lx .lx-ddTrigger { width: 100%; height: 46px; box-sizing: border-box; padding: 0 14px; display: flex; align-items: center; gap: 10px;
    text-align: left; font: 400 15px var(--sans); color: var(--ink); background: #fff; border: 1.5px solid var(--cta); border-radius: 10px; cursor: pointer; }
  .lx .lx-dd.open .lx-ddTrigger { border-radius: 10px 10px 0 0; }
  .lx .lx-dd.serif .lx-ddTrigger, .lx .lx-dd.serif .lx-ddOption { font: 500 20px/24px var(--serif); }
  .lx .lx-ddLead, .lx .lx-ddChev { display: flex; flex: none; color: var(--muted); }
  .lx .lx-ddValue { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lx .lx-ddValue.placeholder { color: var(--muted); }
  .lx .lx-ddList { box-sizing: border-box; max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid var(--border); border-top: none; border-radius: 0 0 10px 10px; }
  .lx .lx-ddOption { width: 100%; box-sizing: border-box; min-height: 40px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    text-align: left; font: 400 14px var(--sans); color: var(--ink); background: none; border: none; border-top: 1px solid var(--rule); cursor: pointer; }
  .lx .lx-dd.serif .lx-ddOption { min-height: 44px; }
  .lx .lx-ddOption:hover { background: rgba(237,230,212,0.5); }
  .lx .lx-ddOption[aria-selected="true"] { background: var(--btn); font-weight: 600; }
  .lx .lx-ddOption svg { flex: none; }

  /* goal picker: radio rows with an optional one-line description */
  .lx .lx-goals { border-top: 1px solid var(--rule); }
  .lx .lx-goal { width: 100%; box-sizing: border-box; padding: 0 var(--lx-edge, 32px); min-height: 60px; display: flex; align-items: center; gap: 14px;
    text-align: left; background: none; border: none; border-bottom: 1px solid var(--rule); cursor: pointer; color: var(--ink); }
  .lx .lx-goal.checked { background: var(--btn); }
  .lx .lx-radio { flex: none; width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 1.5px solid var(--radio); display: flex; align-items: center; justify-content: center; }
  .lx .lx-goal.checked .lx-radio { border: none; background: var(--chip-on); color: var(--ink); }
  .lx .lx-goalText { min-width: 0; flex: 1; }
  .lx .lx-goalName { display: block; font: 500 20px/24px var(--serif); }
  .lx .lx-goalDesc { display: block; margin-top: 1px; font: 400 12px/14px var(--sans); color: var(--muted); }

  /* "Which industry?": a text field plus suggestion chips */
  .lx .lx-industry { box-sizing: border-box; padding: 18px var(--lx-edge, 32px) 20px; border-bottom: 1px solid var(--rule); }
  .lx .lx-industry .lx-field { margin-top: 8px; }
  .lx .lx-chips { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .lx .lx-chip { height: 32px; box-sizing: border-box; padding: 0 14px; border: none; border-radius: 16px; font: 500 12px var(--sans); color: var(--muted); background: var(--btn); cursor: pointer; }
  .lx .lx-chip[aria-pressed="true"] { background: var(--chip-on); color: var(--ink); font-weight: 600; }
  .lx .lx-chip:hover:not([aria-pressed="true"]) { background: #E6DEC9; }
  /* eased, not snapped: dropdown lists drop in, the industry field unfolds under the goal, selections settle */
  @keyframes lxDrop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes lxFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: no-preference) {
    .lx .lx-ddList { animation: lxDrop 160ms cubic-bezier(0.22, 0.9, 0.3, 1); }
    .lx .lx-industry { animation: lxFadeUp 240ms cubic-bezier(0.22, 0.9, 0.3, 1); }
    .lx .lx-goal, .lx .lx-ddOption, .lx .lx-chip, .lx .lx-radio, .lx .lx-field, .lx .lx-ddTrigger { transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease; }
  }
  .lx button:focus-visible, .lx input:focus-visible { outline: 1.5px solid #77736C; outline-offset: 2px; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownOptions {
  ariaLabel: string;
  options: DropdownOption[];
  value: string | null;
  placeholder?: string;
  // "others": the selected option lives only in the trigger and the list shows the rest (goals).
  // "all": the list shows every option with the selected one highlighted and ticked (times).
  mode: "others" | "all";
  serif?: boolean;
  leadingIcon?: string; // trusted, static SVG markup
  onChange(value: string): void;
}

export interface Dropdown {
  el: HTMLElement;
  setValue(value: string | null): void;
  getValue(): string | null;
}

export function createDropdown(opts: DropdownOptions): Dropdown {
  const root = el("div", `lx-dd${opts.serif ? " serif" : ""}`);
  let value = opts.value;
  let open = false;

  const trigger = el("button", "lx-ddTrigger");
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "listbox");
  const lead = el("span", "lx-ddLead");
  if (opts.leadingIcon) lead.innerHTML = opts.leadingIcon;
  const valueEl = el("span", "lx-ddValue");
  const chev = el("span", "lx-ddChev");
  if (opts.leadingIcon) trigger.appendChild(lead);
  trigger.append(valueEl, chev);

  const list = el("div", "lx-ddList");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", opts.ariaLabel);

  root.append(trigger, list);

  function labelFor(v: string | null): string | undefined {
    return opts.options.find((o) => o.value === v)?.label;
  }

  function paint(): void {
    const current = labelFor(value);
    valueEl.textContent = current ?? opts.placeholder ?? "";
    valueEl.classList.toggle("placeholder", current === undefined);
    trigger.setAttribute("aria-label", `${opts.ariaLabel}${current ? `: ${current}` : ""}`);
    trigger.setAttribute("aria-expanded", String(open));
    chev.innerHTML = open ? ICON_CHEV_UP : ICON_CHEV_DOWN;
    root.classList.toggle("open", open);
    list.hidden = !open;
    list.innerHTML = "";
    if (!open) return;
    for (const o of opts.options) {
      const selected = o.value === value;
      if (opts.mode === "others" && selected) continue;
      const btn = el("button", "lx-ddOption");
      btn.type = "button";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(selected));
      btn.append(el("span", undefined, o.label));
      if (selected) {
        const tick = el("span");
        tick.innerHTML = TICK;
        btn.appendChild(tick);
      }
      btn.addEventListener("click", () => {
        value = o.value;
        open = false;
        paint();
        opts.onChange(o.value);
      });
      list.appendChild(btn);
    }
  }

  trigger.addEventListener("click", () => {
    open = !open;
    paint();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      open = false;
      paint();
      trigger.focus();
    }
  });
  // Close on a click anywhere else; composedPath() so this also works inside a Shadow DOM. Drops itself once the
  // dropdown has been removed from the page (the side panel re-renders whole views).
  const onDocClick = (e: Event) => {
    if (!root.isConnected) {
      document.removeEventListener("click", onDocClick, true);
      return;
    }
    if (open && !e.composedPath().includes(root)) {
      open = false;
      paint();
    }
  };
  document.addEventListener("click", onDocClick, true);

  paint();
  return {
    el: root,
    setValue(v) {
      value = v;
      paint();
    },
    getValue: () => value,
  };
}

export interface IndustryField {
  el: HTMLElement;
  getValue(): string;
}

// "Which industry?" - only shown after the "Learn industry jargon" goal. Free text, with one-tap suggestions.
export function createIndustryField(initial: string, onChange: (industry: string) => void): IndustryField {
  const wrap = el("div", "lx-industry");
  const label = el("label", "lx-label", "Which industry?");
  const input = el("input", "lx-field");
  input.type = "text";
  input.id = `lx-industry-${Math.random().toString(36).slice(2, 8)}`;
  label.htmlFor = input.id;
  input.placeholder = "e.g. healthcare, law, finance";
  input.value = initial;
  const chips = el("div", "lx-chips");

  function paintChips(): void {
    chips.innerHTML = "";
    for (const name of INDUSTRY_SUGGESTIONS) {
      const chip = el("button", "lx-chip", name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(input.value.trim().toLowerCase() === name.toLowerCase()));
      chip.addEventListener("click", () => {
        input.value = name;
        paintChips();
        onChange(name);
      });
      chips.appendChild(chip);
    }
  }
  input.addEventListener("input", () => {
    paintChips();
    onChange(input.value);
  });
  paintChips();
  wrap.append(label, input, chips);
  return { el: wrap, getValue: () => input.value };
}

export interface GoalPicker {
  el: HTMLElement;
  getValue(): { goal: GoalId | null; industry: string };
}

// Onboarding's goal step: five radio rows, and the industry field opens directly under "Learn industry jargon".
export function createGoalPicker(
  initial: { goal: GoalId | null; industry: string },
  onChange: (value: { goal: GoalId | null; industry: string }) => void
): GoalPicker {
  const root = el("div", "lx-goals");
  root.setAttribute("role", "radiogroup");
  root.setAttribute("aria-label", "Your goal");
  let goal = initial.goal;
  let industry = initial.industry;

  function paint(): void {
    root.innerHTML = "";
    for (const g of GOALS) {
      const row = el("button", `lx-goal${g.id === goal ? " checked" : ""}`);
      row.type = "button";
      row.setAttribute("role", "radio");
      row.setAttribute("aria-checked", String(g.id === goal));
      const radio = el("span", "lx-radio");
      if (g.id === goal) radio.innerHTML = TICK;
      const text = el("span", "lx-goalText");
      text.append(el("span", "lx-goalName", g.label), el("span", "lx-goalDesc", g.description));
      row.append(radio, text);
      row.addEventListener("click", () => {
        if (goal === g.id) return;
        goal = g.id;
        paint();
        onChange({ goal, industry });
      });
      root.appendChild(row);
      if (g.id === goal && needsIndustry(goal)) {
        root.appendChild(
          createIndustryField(industry, (v) => {
            industry = v;
            onChange({ goal, industry });
          }).el
        );
      }
    }
  }
  paint();
  return { el: root, getValue: () => ({ goal, industry }) };
}
