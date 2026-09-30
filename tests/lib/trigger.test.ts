import { describe, it, expect } from "vitest";
import { shouldShowWidgetToday, shouldShowTodayWordBanner } from "../../src/lib/trigger";

describe("shouldShowWidgetToday", () => {
  it("shows when nothing has been shown yet", () => {
    expect(shouldShowWidgetToday(null, "2026-09-19")).toBe(true);
  });

  it("does not show again the same day", () => {
    expect(shouldShowWidgetToday("2026-09-19", "2026-09-19")).toBe(false);
  });

  it("shows again on a new day", () => {
    expect(shouldShowWidgetToday("2026-09-18", "2026-09-19")).toBe(true);
  });
});

describe("shouldShowTodayWordBanner", () => {
  const base = {
    todayWordDate: "2026-09-19",
    currentDate: "2026-09-19",
    widgetState: { date: "2026-09-19", mode: "closed" as const },
    alreadySaved: false,
  };

  it("shows when the widget is closed and the word is still unsaved", () => {
    expect(shouldShowTodayWordBanner(base)).toBe(true);
  });

  it("does not show while the widget is open or minimised", () => {
    expect(shouldShowTodayWordBanner({ ...base, widgetState: { date: "2026-09-19", mode: "expanded" } })).toBe(false);
    expect(shouldShowTodayWordBanner({ ...base, widgetState: { date: "2026-09-19", mode: "collapsed" } })).toBe(false);
  });

  it("does not show when the widget hasn't been shown today or its state is from a previous day", () => {
    expect(shouldShowTodayWordBanner({ ...base, widgetState: null })).toBe(false);
    expect(shouldShowTodayWordBanner({ ...base, widgetState: { date: "2026-09-18", mode: "closed" } })).toBe(false);
  });

  it("does not show once the word is saved", () => {
    expect(shouldShowTodayWordBanner({ ...base, alreadySaved: true })).toBe(false);
  });

  it("does not show a stale word from a previous day", () => {
    expect(shouldShowTodayWordBanner({ ...base, todayWordDate: "2026-09-18" })).toBe(false);
  });
});
