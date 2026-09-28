import { describe, it, expect } from "vitest";
import {
  buildExplainPrompt,
  parseExplainResponse,
  buildWordOfDayPrompt,
  parseWordOfDayResponse,
  normaliseTopic,
  TOPICS,
} from "../../src/lib/prompts";

describe("prompt builders and parsers", () => {
  it("includes the word in the explain prompt", () => {
    expect(buildExplainPrompt("ephemeral")).toContain("ephemeral");
  });

  it("asks the model to pick a topic from the fixed list", () => {
    const prompt = buildExplainPrompt("ephemeral");
    for (const topic of TOPICS) expect(prompt).toContain(topic);
  });

  it("parses a valid explain response", () => {
    const result = parseExplainResponse(
      '{"meaning":"lasting a short time","example":"It was ephemeral.","pronunciation":"/əˈfem(ə)rəl/","partOfSpeech":"adjective","topic":"Everyday"}'
    );
    expect(result).toEqual({
      meaning: "lasting a short time",
      example: "It was ephemeral.",
      pronunciation: "/əˈfem(ə)rəl/",
      partOfSpeech: "adjective",
      topic: "Everyday",
    });
  });

  it("defaults pronunciation and part of speech to empty strings when the model omits them", () => {
    const result = parseExplainResponse('{"meaning":"lasting a short time","example":"It was ephemeral."}');
    expect(result).toEqual({
      meaning: "lasting a short time",
      example: "It was ephemeral.",
      pronunciation: "",
      partOfSpeech: "",
      topic: "Other",
    });
  });

  it("normalises the topic to the fixed list and falls back to Other", () => {
    expect(normaliseTopic("technology")).toBe("Technology");
    expect(normaliseTopic(" Design ")).toBe("Design");
    expect(normaliseTopic("astrology")).toBe("Other");
    expect(normaliseTopic(undefined)).toBe("Other");
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
