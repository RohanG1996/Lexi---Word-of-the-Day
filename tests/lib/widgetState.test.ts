import { describe, it, expect } from "vitest";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import { createWidgetStateStore, resolveWidgetMode } from "../../src/lib/widgetState";

describe("widget state store", () => {
  it("is empty until something is stored", async () => {
    expect(await createWidgetStateStore(createFakeStorageArea()).getState()).toBeNull();
  });

  it("round-trips the state", async () => {
    const store = createWidgetStateStore(createFakeStorageArea());
    await store.setState({ date: "2026-09-30", mode: "collapsed" });
    expect(await store.getState()).toEqual({ date: "2026-09-30", mode: "collapsed" });
  });

  it("ignores stored junk", async () => {
    const area = createFakeStorageArea();
    await area.set({ "lexi.widgetState": { date: 5, mode: "sideways" } });
    expect(await createWidgetStateStore(area).getState()).toBeNull();
  });
});

describe("resolveWidgetMode", () => {
  it("shows today's expanded or minimised state", () => {
    expect(resolveWidgetMode({ date: "2026-09-30", mode: "expanded" }, "2026-09-30")).toBe("expanded");
    expect(resolveWidgetMode({ date: "2026-09-30", mode: "collapsed" }, "2026-09-30")).toBe("collapsed");
  });

  it("shows nothing when it was closed, never triggered, or is from another day", () => {
    expect(resolveWidgetMode({ date: "2026-09-30", mode: "closed" }, "2026-09-30")).toBeNull();
    expect(resolveWidgetMode(null, "2026-09-30")).toBeNull();
    expect(resolveWidgetMode({ date: "2026-09-29", mode: "expanded" }, "2026-09-30")).toBeNull();
  });
});
