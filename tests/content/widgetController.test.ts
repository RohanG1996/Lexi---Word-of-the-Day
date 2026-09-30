import { describe, it, expect, vi } from "vitest";
import { createWidgetController } from "../../src/content/widgetController";
import { createWidgetHost, type WidgetHost, type WidgetView } from "../../src/content/widget";
import type { WidgetState } from "../../src/lib/widgetState";

const DATA = { word: "candescent", meaning: "glowing", example: "The embers were candescent.", pronunciation: "/x/", partOfSpeech: "adjective" };
const TODAY = "2026-09-30";

// A shared "storage" and any number of tabs (each with its own host) reading and writing it - the whole point of
// the controller is that they stay in step.
function setup(tabCount = 1, initial: WidgetState | null = { date: TODAY, mode: "expanded" }) {
  let state = initial;
  let saved = false;
  const tabs = Array.from({ length: tabCount }, () => {
    const updates: Array<{ view: WidgetView | null; animate?: boolean }> = [];
    const host: WidgetHost = { update: (view, opts) => void updates.push({ view, animate: opts?.animate }) };
    const controller = createWidgetController({
      state: { get: async () => state, set: async (s) => void (state = s) },
      todayWord: async () => ({ data: DATA, saved }),
      save: async () => void (saved = true),
      today: () => TODAY,
      host,
    });
    return { updates, controller, last: () => updates.at(-1)?.view };
  });
  return { tabs, getState: () => state, setSaved: (v: boolean) => (saved = v) };
}

describe("widget controller", () => {
  it("shows the expanded widget from the shared state", async () => {
    const { tabs } = setup();
    await tabs[0].controller.refresh();
    expect(tabs[0].last()).toMatchObject({ data: DATA, collapsed: false, saved: false });
  });

  it("shows the minimised pill when the shared state is collapsed", async () => {
    const { tabs } = setup(1, { date: TODAY, mode: "collapsed" });
    await tabs[0].controller.refresh();
    expect(tabs[0].last()).toMatchObject({ collapsed: true });
  });

  it("shows nothing when closed, when it isn't today's state, or when there is no state", async () => {
    for (const s of [{ date: TODAY, mode: "closed" as const }, { date: "2026-09-29", mode: "expanded" as const }, null]) {
      const { tabs } = setup(1, s);
      await tabs[0].controller.refresh();
      expect(tabs[0].last()).toBeNull();
    }
  });

  it("minimising in one tab minimises it in every tab", async () => {
    const { tabs, getState } = setup(3);
    for (const t of tabs) await t.controller.refresh();
    tabs[0].controller.handlers.onToggleCollapse();
    await vi.waitFor(() => expect(getState()?.mode).toBe("collapsed"));
    // the other tabs hear about it through storage.onChanged, which the content script turns into refresh()
    for (const t of tabs) await t.controller.refresh(true);
    expect(tabs.map((t) => t.last())).toEqual([
      expect.objectContaining({ collapsed: true }),
      expect.objectContaining({ collapsed: true }),
      expect.objectContaining({ collapsed: true }),
    ]);
  });

  it("re-opens from the pill in any tab", async () => {
    const { tabs, getState } = setup(2, { date: TODAY, mode: "collapsed" });
    await tabs[1].controller.refresh();
    tabs[1].controller.handlers.onToggleCollapse();
    await vi.waitFor(() => expect(getState()?.mode).toBe("expanded"));
    await tabs[0].controller.refresh();
    expect(tabs[0].last()).toMatchObject({ collapsed: false });
  });

  it("closing in one tab removes it from every tab", async () => {
    const { tabs, getState } = setup(2);
    for (const t of tabs) await t.controller.refresh();
    tabs[1].controller.handlers.onClose();
    await vi.waitFor(() => expect(getState()?.mode).toBe("closed"));
    for (const t of tabs) await t.controller.refresh(true);
    expect(tabs.map((t) => t.last())).toEqual([null, null]);
  });

  it("saving in one tab shows the word as added in the others", async () => {
    const { tabs } = setup(2);
    for (const t of tabs) await t.controller.refresh();
    await tabs[0].controller.handlers.onSave();
    await tabs[1].controller.refresh();
    expect(tabs[0].last()).toMatchObject({ saved: true });
    expect(tabs[1].last()).toMatchObject({ saved: true });
  });

  it("only asks to slide in when told the widget newly appeared", async () => {
    const { tabs } = setup();
    await tabs[0].controller.refresh(false);
    await tabs[0].controller.refresh(true);
    expect(tabs[0].updates.map((u) => u.animate)).toEqual([false, true]);
  });
});

describe("createWidgetHost", () => {
  const handlers = { onClose: vi.fn(), onToggleCollapse: vi.fn(), onSave: vi.fn() };
  const view = (collapsed: boolean, saved = false): WidgetView => ({ data: DATA, collapsed, saved });

  it("draws one host element, redraws only on change, and removes it on null", () => {
    document.body.innerHTML = "";
    const host = createWidgetHost(handlers);
    host.update(view(false));
    host.update(view(false));
    expect(document.querySelectorAll("#lexi-widget-host")).toHaveLength(1);
    const root = document.getElementById("lexi-widget-host")!.shadowRoot!;
    expect(root.querySelector(".card")).not.toBeNull();

    host.update(view(true));
    expect(root.querySelector(".pill")).not.toBeNull();
    expect(root.querySelector(".pill")!.classList.contains("settle")).toBe(true);

    host.update(null);
    expect(document.getElementById("lexi-widget-host")).toBeNull();
  });

  it("starts in the added state when the word is already saved", () => {
    document.body.innerHTML = "";
    createWidgetHost(handlers).update(view(false, true));
    const btn = document.getElementById("lexi-widget-host")!.shadowRoot!.querySelector(".saveBtn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Added to my library");
  });

  it("does not animate a widget that is simply there when a page loads", () => {
    document.body.innerHTML = "";
    createWidgetHost(handlers).update(view(false));
    const card = document.getElementById("lexi-widget-host")!.shadowRoot!.querySelector(".card")!;
    expect(card.classList.contains("enter")).toBe(false);
    expect(card.classList.contains("unfold")).toBe(false);
  });
});
