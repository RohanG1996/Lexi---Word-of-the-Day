import { describe, it, expect } from "vitest";
import { shouldShowWidgetToday } from "../../src/lib/trigger";

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
