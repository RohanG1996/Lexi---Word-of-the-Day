import { describe, it, expect } from "vitest";
import { createDetailCache } from "../../src/lib/cache";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";

describe("createDetailCache", () => {
  it("returns undefined for a word not yet cached", async () => {
    const cache = createDetailCache(createFakeStorageArea());
    expect(await cache.getDetail("ephemeral")).toBeUndefined();
  });

  it("stores and retrieves a word's full detail, case-insensitively", async () => {
    const cache = createDetailCache(createFakeStorageArea());
    await cache.setDetail({ word: "Ephemeral", meaning: "lasting a short time", example: "It was ephemeral.", cachedAt: "2026-09-19" });
    const detail = await cache.getDetail("ephemeral");
    expect(detail?.meaning).toBe("lasting a short time");
  });
});
