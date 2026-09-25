import { describe, it, expect } from "vitest";
import {
  buildExplainPrompt,
  parseExplainResponse,
  buildWordOfDayPrompt,
  parseWordOfDayResponse,
} from "../../src/lib/prompts";

describe("prompt builders and parsers", () => {
  it("includes the word in the explain prompt", () => {
    expect(buildExplainPrompt("ephemeral")).toContain("ephemeral");
  });

  it("parses a valid explain response", () => {
    const result = parseExplainResponse(
      '{"meaning":"lasting a short time","example":"It was ephemeral.","pronunciation":"/əˈfem(ə)rəl/","partOfSpeech":"adjective"}'
    );
    expect(result).toEqual({
      meaning: "lasting a short time",
      example: "It was ephemeral.",
      pronunciation: "/əˈfem(ə)rəl/",
      partOfSpeech: "adjective",
    });
  });

  it("defaults pronunciation and part of speech to empty strings when the model omits them", () => {
    const result = parseExplainResponse('{"meaning":"lasting a short time","example":"It was ephemeral."}');
    expect(result).toEqual({
      meaning: "lasting a short time",
      example: "It was ephemeral.",
      pronunciation: "",
      partOfSpeech: "",
    });
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
