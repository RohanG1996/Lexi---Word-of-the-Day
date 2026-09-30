import { resolveWidgetMode, type WidgetMode, type WidgetState } from "../lib/widgetState";
import type { WidgetData, WidgetHost } from "./widget";

// Keeps this tab's widget in step with the shared state, so it is on every tab, minimises everywhere at once, and
// stays closed everywhere once closed. Pure and dependency-injected (like renderWidget) so it can be tested; the
// real chrome.storage wiring is in content/index.ts.

export interface ControllerDeps {
  state: { get(): Promise<WidgetState | null>; set(state: WidgetState): Promise<void> };
  // Today's word ready to show (with whether it is already in the library), or null when there isn't one yet.
  todayWord(): Promise<{ data: WidgetData; saved: boolean } | null>;
  save(): Promise<void>;
  today(): string;
  host: WidgetHost;
}

export function createWidgetController(deps: ControllerDeps) {
  async function current(): Promise<"expanded" | "collapsed" | null> {
    return resolveWidgetMode(await deps.state.get(), deps.today());
  }

  // `animate`: this render is the widget newly appearing live (not just a page loading with it already there), so
  // it may slide in.
  async function refresh(animate = false): Promise<void> {
    const mode = await current();
    const word = mode ? await deps.todayWord() : null;
    if (!mode || !word) {
      deps.host.update(null);
      return;
    }
    deps.host.update({ data: word.data, saved: word.saved, collapsed: mode === "collapsed" }, { animate });
  }

  async function setMode(mode: WidgetMode): Promise<void> {
    await deps.state.set({ date: deps.today(), mode });
    // Other tabs pick the change up from storage; this one doesn't wait for that round trip.
    await refresh();
  }

  const handlers = {
    onClose: () => void setMode("closed"),
    onToggleCollapse: () => {
      void current().then((mode) => setMode(mode === "collapsed" ? "expanded" : "collapsed"));
    },
    onSave: async () => {
      await deps.save();
      await refresh();
    },
  };

  return { refresh, handlers };
}
