import { describe, it, expect } from "vitest";
import { createApiKeyStore, isPlausibleApiKey } from "../../src/lib/apiKey";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";

describe("createApiKeyStore", () => {
  it("returns null when no key has been set", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    expect(await store.getApiKey()).toBeNull();
  });

  it("stores and retrieves the key", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    await store.setApiKey("sk-ant-abc123");
    expect(await store.getApiKey()).toBe("sk-ant-abc123");
  });
});

describe("isPlausibleApiKey", () => {
  it("accepts a key with the expected prefix", () => {
    expect(isPlausibleApiKey("sk-ant-abc123")).toBe(true);
  });

  it("rejects an empty or malformed key", () => {
    expect(isPlausibleApiKey("")).toBe(false);
    expect(isPlausibleApiKey("not-a-key")).toBe(false);
  });
});
