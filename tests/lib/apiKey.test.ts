import { describe, it, expect } from "vitest";
import { createApiKeyStore, isPlausibleApiKey } from "../../src/lib/apiKey";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";

describe("createApiKeyStore", () => {
  it("returns null when nothing has been set", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    expect(await store.getSettings()).toBeNull();
  });

  it("stores and retrieves the provider and key together", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    await store.setSettings({ provider: "gemini", key: "AIzaAbc123" });
    expect(await store.getSettings()).toEqual({ provider: "gemini", key: "AIzaAbc123" });
  });

  it("treats a pre-provider bare-string key (old storage shape) as unset rather than passing it through", async () => {
    const area = createFakeStorageArea();
    await area.set({ "lexi.apiKey": "sk-ant-old-format-key" });
    const store = createApiKeyStore(area);
    expect(await store.getSettings()).toBeNull();
  });
});

describe("isPlausibleApiKey", () => {
  it("accepts a key with the expected prefix for its provider", () => {
    expect(isPlausibleApiKey("anthropic", "sk-ant-abc123")).toBe(true);
    expect(isPlausibleApiKey("gemini", "AIzaSyAbc123")).toBe(true);
    expect(isPlausibleApiKey("groq", "gsk_abc123")).toBe(true);
  });

  it("rejects an empty, too-short, or wrong-prefix key", () => {
    expect(isPlausibleApiKey("anthropic", "")).toBe(false);
    expect(isPlausibleApiKey("anthropic", "not-a-key")).toBe(false);
    expect(isPlausibleApiKey("gemini", "sk-ant-abc123")).toBe(false);
  });
});
