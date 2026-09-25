import { describe, it, expect, vi, beforeEach } from "vitest";
import { callGroq } from "../../../src/lib/providers/groq";

describe("callGroq", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the Groq chat completions endpoint with a bearer token and returns the response text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGroq("gsk_test", "a prompt");

    expect(result).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer gsk_test" }),
      })
    );
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(callGroq("gsk_test", "a prompt")).rejects.toThrow("401");
  });

  it("throws a descriptive error when the API responds 200 with an empty/malformed choices array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      })
    );
    await expect(callGroq("gsk_test", "a prompt")).rejects.toThrow("unexpected response shape");
  });
});
