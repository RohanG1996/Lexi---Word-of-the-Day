import { describe, it, expect, vi } from "vitest";
import { renderWidget, snapCardLayout } from "../../src/content/widget";

function makeHandlers() {
  return { onClose: vi.fn(), onToggleCollapse: vi.fn(), onSave: vi.fn().mockResolvedValue(undefined) };
}

function makeData(overrides: Partial<Parameters<typeof renderWidget>[1]> = {}) {
  return {
    word: "ephemeral",
    meaning: "lasting a short time",
    example: "The joy was ephemeral.",
    pronunciation: "/əˈfem(ə)rəl/",
    partOfSpeech: "adjective",
    ...overrides,
  };
}

describe("renderWidget", () => {
  it("renders the word, pronunciation, part of speech, meaning, and example when expanded", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData(), makeHandlers(), false);

    expect(root.querySelector(".word")?.textContent).toBe("ephemeral");
    expect(root.querySelector(".ipa")?.textContent).toBe("/əˈfem(ə)rəl/");
    expect(root.querySelector(".pos")?.textContent).toBe("adjective");
    expect(root.querySelector(".meaning")?.textContent).toBe("lasting a short time");
    expect(root.querySelector(".example")?.textContent).toBe("The joy was ephemeral.");
  });

  it("hides the pronunciation row when there's no pronunciation or part of speech", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData({ pronunciation: "", partOfSpeech: "" }), makeHandlers(), false);

    expect((root.querySelector(".pron") as HTMLElement).hidden).toBe(true);
  });

  it("calls onClose when the close button is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, makeData(), handlers, false);

    (root.querySelector(".closeBtn") as HTMLElement).click();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("calls onToggleCollapse when the minimize button is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, makeData(), handlers, false);

    (root.querySelector(".minimizeBtn") as HTMLElement).click();
    expect(handlers.onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("calls onSave and shows a saved state when the save button is clicked", async () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, makeData(), handlers, false);

    const saveBtn = root.querySelector(".saveBtn") as HTMLButtonElement;
    saveBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(handlers.onSave).toHaveBeenCalledOnce();
    expect(saveBtn.textContent).toContain("Added to my library");
  });

  it("shows an error and re-enables the button when onSave rejects", async () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = { ...makeHandlers(), onSave: vi.fn().mockRejectedValue(new Error("no key")) };
    renderWidget(root, makeData(), handlers, false);

    const saveBtn = root.querySelector(".saveBtn") as HTMLButtonElement;
    saveBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(saveBtn.disabled).toBe(false);
    expect(root.querySelector(".widgetErr")?.textContent).toBe("no key");
  });

  it("renders only the word in a pill when collapsed", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData(), makeHandlers(), true);

    expect(root.querySelector(".pillWord")?.textContent).toBe("ephemeral");
    expect(root.querySelector(".card")).toBeNull();
  });

  it("grows multi-line rows in whole 35px steps and puts their last line on a rule", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData(), makeHandlers(), false);
    const card = root.querySelector(".card") as HTMLElement;

    const heights = new Map<Element, number>([
      [card.querySelector(".meaning .blk")!, 52.5],
      [card.querySelector(".example .blk")!, 17.5],
    ]);
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return { width: 0, height: heights.get(this) ?? 0 } as DOMRect;
    });
    snapCardLayout(card);
    spy.mockRestore();

    const meaning = card.querySelector(".meaning") as HTMLElement;
    const example = card.querySelector(".example") as HTMLElement;
    expect(meaning.style.height).toBe("70px");
    expect(meaning.classList.contains("multi")).toBe(true);
    expect(example.style.height).toBe("35px");
    expect(example.classList.contains("multi")).toBe(false);
  });

  it("shrinks a word that is too wide for the card", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData({ word: "uncharacteristically" }), makeHandlers(), false);
    const card = root.querySelector(".card") as HTMLElement;
    const wordRow = card.querySelector(".wordRow") as HTMLElement;
    const wordEl = card.querySelector(".word") as HTMLElement;

    Object.defineProperty(wordRow, "clientWidth", { value: 253, configurable: true });
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const size = parseInt((this as HTMLElement).style.fontSize || "26", 10);
      return { width: this === wordEl ? size * 10 : 0, height: 0 } as DOMRect;
    });
    snapCardLayout(card);
    spy.mockRestore();

    expect(wordEl.style.fontSize).toBe("22px");
  });

  it("calls onToggleCollapse when the collapsed pill is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, makeData(), handlers, true);

    (root.querySelector(".pill") as HTMLElement).click();
    expect(handlers.onToggleCollapse).toHaveBeenCalledOnce();
  });
});
