import {
  ARRIVAL_TIMES,
  formatTime,
  isProfileComplete,
  suggestName,
  type Profile,
} from "../lib/profile";
import { CONTROLS_CSS, ICON_CLOCK, createDropdown, createGoalPicker } from "../ui/controls";
import { ICON_BACK } from "../lib/icons";
import { logoMarkSvg } from "../lib/logo";

// First-run onboarding: a 4-step dialog centred over the current page (a Shadow DOM, like the widget, so the host
// page's CSS can't touch it). The steps and copy follow the finalised "Lexi Onboarding & Settings" design canvas:
// 1 sign in, 2 name, 3 arrival time, 4 goal (+ industry when the goal is industry jargon).

export interface OnboardingDeps {
  initial: Profile;
  // Resolves to the signed-in Google account's email, or null when there isn't one (the flow carries on either way).
  signIn(): Promise<string | null>;
  save(profile: Profile): Promise<void>;
  onDone(): void;
}

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,500&family=Manrope:wght@400;500;600&display=swap";

const GOOGLE_G = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
const CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,12.5 9.5,18 20,6.5"/></svg>`;

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .scrim { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center;
    padding: 16px; background: rgba(23,23,23,0.45); font-family: var(--sans); }
  .dialog { width: 460px; max-width: 100%; height: 720px; max-height: 100%; display: flex; flex-direction: column;
    background: var(--paper); color: var(--ink); border: 1px solid var(--border); border-radius: 13px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.28); overflow: hidden; }
  button { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }

  .head { flex: none; height: 76px; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(214,100,96,0.7); }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand svg { display: block; }
  .brandName { font: 500 28px/30px var(--serif); }
  .step { font: 500 11px/1 var(--sans); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }

  .body { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 0 24px; }
  .pad { padding: 0 32px; }
  .progress { display: flex; gap: 6px; padding: 0 32px; }
  .progress i { flex: 1; height: 3px; border-radius: 2px; background: #E3DBC6; }
  .progress i.on { background: rgba(214,100,96,0.7); }
  h1 { margin: 28px 32px 0; font: 500 44px/48px var(--serif); }
  .sub { margin: 12px 32px 0; font: 400 15px/23px var(--sans); color: var(--ink-2); }

  .benefits { margin: 24px 32px 0; border-top: 1px solid var(--rule); }
  .benefit { display: flex; align-items: center; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--rule); font: 400 14px var(--sans); }
  .benefit svg { flex: none; color: #B4544F; }
  .google { margin: 28px 32px 0; width: calc(100% - 64px); height: 48px; display: flex; align-items: center; justify-content: center; gap: 12px;
    font: 500 15px var(--sans); color: #2B2822; background: #fff; border: 1.5px solid var(--cta); border-radius: 10px; }
  .google:disabled { opacity: 0.7; cursor: default; }

  .account { margin: 24px 32px 0; padding: 12px 14px; display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid var(--border); border-radius: 10px; }
  .avatar { flex: none; width: 34px; height: 34px; border-radius: 50%; background: #3A3833; color: #fff; display: flex; align-items: center; justify-content: center; font: 600 14px var(--sans); }
  .accountInfo { min-width: 0; flex: 1; }
  .accountInfo .lx-label { font-size: 11px; }
  .email { margin-top: 3px; font: 400 14px var(--sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notYou { flex: none; font: 500 13px var(--sans); color: #A33333; }
  .section { margin: 22px 32px 0; padding-top: 20px; border-top: 1px solid var(--rule); }
  .section.first { margin-top: 24px; }
  .section .lx-field, .section .lx-dd { margin-top: 8px; }

  .foot { flex: none; min-height: 84px; padding: 0 32px; display: flex; align-items: center; gap: 12px; border-top: 1px solid var(--rule); }
  .terms { font: 400 12px/17px var(--sans); color: var(--muted); padding: 18px 0; }
  .back { flex: none; height: 46px; padding: 0 12px 0 0; display: flex; align-items: center; gap: 8px; font: 500 15px var(--sans); color: #2B2822; }
  .back svg { width: 18px; height: 18px; }
  .next { flex: 1; height: 46px; font: 500 15px var(--sans); color: #2B2822; background: var(--btn); border-radius: 10px; }
  .next:hover:not(:disabled) { background: #E6DEC9; }
  .next:disabled { opacity: 0.5; cursor: default; }
  .err { margin: 10px 32px 0; font: 400 12px/16px var(--sans); color: #A33333; }
  .err:empty { display: none; }
  /* The dialog itself eases in once (.intro); on later steps only the step's content glides in, so the frame, header
     and footer stay put instead of the whole dialog popping again. */
  @media (prefers-reduced-motion: no-preference) {
    .dialog.intro { animation: lexiPop 260ms cubic-bezier(0.22, 0.9, 0.3, 1); }
    .dialog:not(.intro) .body > * { animation: lexiStep 240ms cubic-bezier(0.22, 0.9, 0.3, 1) backwards; }
    .scrim { animation: lexiScrim 260ms ease-out; }
    .next, .google { transition: background-color 160ms ease, opacity 160ms ease; }
  }
  @keyframes lexiPop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes lexiStep { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes lexiScrim { from { background: rgba(23,23,23,0); } to { background: rgba(23,23,23,0.45); } }
`;

const TOTAL_STEPS = 4;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderOnboarding(root: ShadowRoot | HTMLElement, deps: OnboardingDeps): void {
  let step = 1;
  let draft: Profile = { ...deps.initial };

  const style = h("style");
  style.textContent = CONTROLS_CSS + CSS;
  const fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href = FONTS_HREF;

  const scrim = h("div", "scrim lx");
  root.replaceChildren(fonts, style, scrim);

  function shell(title: string): { body: HTMLElement; foot: HTMLElement } {
    const firstStep = scrim.childElementCount === 0;
    scrim.replaceChildren();
    const dialog = h("div", firstStep ? "dialog intro" : "dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);

    const head = h("header", "head");
    const brand = h("div", "brand");
    brand.innerHTML = logoMarkSvg(36);
    brand.appendChild(h("div", "brandName", "Lexi"));
    head.append(brand, h("div", "step", `Step ${step} of ${TOTAL_STEPS}`));

    const body = h("div", "body");
    const progress = h("div", "progress");
    for (let i = 1; i <= TOTAL_STEPS; i++) progress.appendChild(h("i", i <= step ? "on" : ""));
    body.appendChild(progress);

    const foot = h("footer", "foot");
    dialog.append(head, body, foot);
    scrim.appendChild(dialog);
    return { body, foot };
  }

  function heading(body: HTMLElement, title: string, sub: string): void {
    body.append(h("h1", undefined, title), h("p", "sub", sub));
  }

  function footer(foot: HTMLElement, opts: { nextLabel: string; enabled: () => boolean; onNext: () => void }): () => void {
    const back = h("button", "back");
    back.type = "button";
    back.innerHTML = ICON_BACK;
    back.append("Back");
    back.addEventListener("click", () => go(step - 1));
    const next = h("button", "next", opts.nextLabel);
    next.type = "button";
    next.addEventListener("click", opts.onNext);
    foot.append(back, next);
    const refresh = () => {
      next.disabled = !opts.enabled();
    };
    refresh();
    return refresh;
  }

  function go(to: number): void {
    step = Math.min(Math.max(to, 1), TOTAL_STEPS);
    [stepWelcome, stepName, stepTime, stepGoal][step - 1]();
  }

  function stepWelcome(): void {
    const { body, foot } = shell("Welcome to Lexi");
    heading(body, "Welcome to Lexi", "One good word a day, picked for you. Sign in to keep your library safe and in sync.");
    const list = h("div", "benefits");
    for (const line of [
      "A fresh word every day, at the time you choose",
      "Save any word by highlighting it on a page",
      "Your library follows you across devices",
    ]) {
      const row = h("div", "benefit");
      row.innerHTML = CHECK;
      row.appendChild(h("span", undefined, line));
      list.appendChild(row);
    }
    body.appendChild(list);

    const google = h("button", "google");
    google.type = "button";
    google.innerHTML = GOOGLE_G;
    google.append("Continue with Google");
    google.addEventListener("click", async () => {
      google.disabled = true;
      let email: string | null = null;
      try {
        email = await deps.signIn();
      } catch {
        email = null;
      }
      draft = { ...draft, email: email ?? "" };
      if (!draft.name.trim() && email) draft.name = suggestName(email);
      go(2);
    });
    body.appendChild(google);

    foot.appendChild(h("div", "terms", "By continuing you agree to the Terms and Privacy Policy. Lexi only reads your name and email."));
  }

  function stepName(): void {
    const { body, foot } = shell("Your name");
    heading(body, "What should we call you?", "Your library will carry your name. You can change it later in settings.");

    if (draft.email) {
      const card = h("div", "account");
      card.append(h("div", "avatar", (draft.name.trim() || draft.email).charAt(0).toUpperCase()));
      const info = h("div", "accountInfo");
      info.append(h("div", "lx-label", "Signed in with Google"), h("div", "email", draft.email));
      const notYou = h("button", "notYou", "Not you?");
      notYou.type = "button";
      notYou.addEventListener("click", () => {
        draft = { ...draft, email: "" };
        stepName();
      });
      card.append(info, notYou);
      body.appendChild(card);
    }

    const section = h("div", `section${draft.email ? "" : " first"}`);
    const label = h("label", "lx-label", "Your name");
    const input = h("input", "lx-field");
    input.type = "text";
    input.id = "lexi-name";
    label.htmlFor = input.id;
    input.value = draft.name;
    input.autocomplete = "given-name";
    section.append(label, input, h("div", "lx-help", "This is the title of your library."));
    body.appendChild(section);

    const refresh = footer(foot, {
      nextLabel: "Continue",
      enabled: () => draft.name.trim().length > 0,
      onNext: () => go(3),
    });
    input.addEventListener("input", () => {
      draft = { ...draft, name: input.value };
      refresh();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && draft.name.trim()) go(3);
    });
    input.focus();
  }

  function stepTime(): void {
    const { body, foot } = shell("When your word arrives");
    heading(body, "When should your word arrive?", "One word a day, at the time you choose. You can change it any time in settings.");
    const section = h("div", "section first");
    section.appendChild(h("span", "lx-label", "Arrives at"));
    const help = h("div", "lx-help", `Your word arrives every day at ${formatTime(draft.arrivalTime)}.`);
    const dd = createDropdown({
      ariaLabel: "Arrives at",
      options: ARRIVAL_TIMES,
      value: draft.arrivalTime,
      mode: "all",
      leadingIcon: ICON_CLOCK,
      onChange: (v) => {
        draft = { ...draft, arrivalTime: v };
        help.textContent = `Your word arrives every day at ${formatTime(v)}.`;
      },
    });
    section.append(dd.el, help);
    body.appendChild(section);
    footer(foot, { nextLabel: "Continue", enabled: () => true, onNext: () => go(4) });
  }

  function stepGoal(): void {
    const { body, foot } = shell("Your goal");
    heading(body, "What is your goal?", "Lexi picks your words to match. Choose the one that fits best, and change it any time.");
    const errEl = h("div", "err");
    const wrap = h("div");
    wrap.style.marginTop = "22px";
    body.append(wrap, errEl);

    let refresh: () => void = () => {};
    const picker = createGoalPicker({ goal: draft.goal, industry: draft.industry }, (v) => {
      draft = { ...draft, goal: v.goal, industry: v.industry };
      refresh();
    });
    wrap.appendChild(picker.el);

    refresh = footer(foot, {
      nextLabel: "Start learning",
      enabled: () => isProfileComplete(draft),
      onNext: async () => {
        const next = foot.querySelector(".next") as HTMLButtonElement;
        next.disabled = true;
        next.textContent = "Saving…";
        try {
          await deps.save({ ...draft, name: draft.name.trim(), industry: draft.industry.trim(), onboarded: true });
          deps.onDone();
        } catch (err) {
          errEl.textContent = err instanceof Error ? err.message : "Couldn't save your choices. Try again.";
          next.textContent = "Start learning";
          refresh();
        }
      },
    });
  }

  stepWelcome();
}

const HOST_ID = "lexi-onboarding-host";

// Thin wiring, like mountWidget: a fixed host element on the page holding the shadow root. Guarded so re-injecting
// the script into the same tab doesn't stack a second dialog.
export function mountOnboarding(deps: Omit<OnboardingDeps, "onDone">): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  renderOnboarding(root, { ...deps, onDone: () => host.remove() });
}
