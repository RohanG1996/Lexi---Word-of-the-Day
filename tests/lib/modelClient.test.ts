import { describe, it, expect, vi, beforeEach } from "vitest";
import { createModelClient } from "../../src/lib/modelClient";

describe("createModelClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes to the Anthropic endpoint for the anthropic provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"meaning":"m","example":"e"}' }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createModelClient("anthropic", "sk-ant-test");
    const result = await client.explainWord("ephemeral");

    expect(result).toEqual({ meaning: "m", example: "e", pronunciation: "", partOfSpeech: "", topic: "Other" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("routes to the Gemini endpoint for the gemini provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"word":"lucid"}' }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createModelClient("gemini", "AIzaTest");
    const result = await client.pickWordOfDay([]);

    expect(result).toBe("lucid");
    expect(fetchMock.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });

  it("routes to the Groq endpoint for the groq provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"meaning":"m","example":"e"}' } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createModelClient("groq", "gsk_test");
    const result = await client.explainWord("ephemeral");

    expect(result).toEqual({ meaning: "m", example: "e", pronunciation: "", partOfSpeech: "", topic: "Other" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});
