import { describe, it, expect, vi, beforeEach } from "vitest";
import { callGemini } from "../../../src/lib/providers/gemini";

describe("callGemini", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the Gemini generateContent endpoint with the key in the URL and returns the response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGemini("AIzaTest", "a prompt");

    expect(result).toBe("hello");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=AIzaTest");
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(callGemini("AIzaTest", "a prompt")).rejects.toThrow("401");
  });

  it("throws a descriptive error when the API responds 200 with an empty/malformed candidates array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      })
    );
    await expect(callGemini("AIzaTest", "a prompt")).rejects.toThrow("unexpected response shape");
  });
});
