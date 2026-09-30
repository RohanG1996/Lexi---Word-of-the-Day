import type { StorageArea } from "./storage";

const KEY = "lexi.widgetState"; // local - per device, shared by every tab on it

// What the floating widget is doing today, for ALL tabs at once. The widget lives in a content script, and every
// tab has its own copy of the page, so the only way for them to agree is to keep the state here and have each tab
// render from it (and re-render when it changes) instead of each holding its own private "collapsed"/"closed".
export type WidgetMode = "expanded" | "collapsed" | "closed";

export interface WidgetState {
  date: string; // ISO date the state belongs to - a new day starts fresh
  mode: WidgetMode;
}

function isMode(value: unknown): value is WidgetMode {
  return value === "expanded" || value === "collapsed" || value === "closed";
}

export function createWidgetStateStore(area: StorageArea) {
  async function getState(): Promise<WidgetState | null> {
    const stored = (await area.get(KEY))[KEY] as Partial<WidgetState> | undefined;
    if (!stored || typeof stored.date !== "string" || !isMode(stored.mode)) return null;
    return { date: stored.date, mode: stored.mode };
  }
  async function setState(state: WidgetState): Promise<void> {
    await area.set({ [KEY]: state });
  }
  return { getState, setState };
}

// The mode to show today, or null when the widget shouldn't be on screen (never triggered today, closed, or a
// leftover from a previous day).
export function resolveWidgetMode(state: WidgetState | null, today: string): "expanded" | "collapsed" | null {
  if (!state || state.date !== today || state.mode === "closed") return null;
  return state.mode;
}

export const WIDGET_STATE_KEY = KEY;
