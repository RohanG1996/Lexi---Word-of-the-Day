import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExplainPrompt,
  parseExplainResponse,
  buildWordOfDayPrompt,
  parseWordOfDayResponse,
  createClaudeClient,
} from "../../src/lib/claudeClient";

describe("prompt builders and parsers", () => {
  it("includes the word in the explain prompt", () => {
    expect(buildExplainPrompt("ephemeral")).toContain("ephemeral");
  });

  it("parses a valid explain response", () => {
    const result = parseExplainResponse('{"meaning":"lasting a short time","example":"It was ephemeral."}');
    expect(result).toEqual({ meaning: "lasting a short time", example: "It was ephemeral." });
  });

  it("throws on a malformed explain response", () => {
    expect(() => parseExplainResponse('{"meaning":"only"}')).toThrow();
  });

  it("excludes previously used words from the word-of-day prompt", () => {
    const prompt = buildWordOfDayPrompt(["ephemeral", "lucid"]);
    expect(prompt).toContain("ephemeral");
    expect(prompt).toContain("lucid");
  });

  it("parses and trims a valid word-of-day response", () => {
    expect(parseWordOfDayResponse('{"word":" lucid "}')).toBe("lucid");
  });

  it("throws on a malformed word-of-day response", () => {
    expect(() => parseWordOfDayResponse('{"word":""}')).toThrow();
  });
});

describe("createClaudeClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("explainWord calls the API and returns the parsed explanation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"meaning":"m","example":"e"}' }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createClaudeClient("sk-ant-test");
    const result = await client.explainWord("ephemeral");

    expect(result).toEqual({ meaning: "m", example: "e" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const client = createClaudeClient("sk-ant-test");
    await expect(client.explainWord("ephemeral")).rejects.toThrow("401");
  });
});
