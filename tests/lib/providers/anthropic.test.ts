import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAnthropic } from "../../../src/lib/providers/anthropic";

describe("callAnthropic", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the Anthropic messages endpoint and returns the response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: "hello" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAnthropic("sk-ant-test", "a prompt");

    expect(result).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "sk-ant-test" }),
      })
    );
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(callAnthropic("sk-ant-test", "a prompt")).rejects.toThrow("401");
  });

  it("throws a descriptive error when the API responds 200 with an empty/malformed content array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [] }),
      })
    );
    await expect(callAnthropic("sk-ant-test", "a prompt")).rejects.toThrow("unexpected response shape");
  });
});
