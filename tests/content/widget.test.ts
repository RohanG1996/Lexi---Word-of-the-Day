import { describe, it, expect, vi } from "vitest";
import { renderWidget, fitWord } from "../../src/content/widget";

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
    expect(saveBtn.classList.contains("saved")).toBe(true);
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

  it("shows the zero-padded word number only when one is provided", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData({ wordNumber: 27 }), makeHandlers(), false);
    expect(root.querySelector(".num")?.textContent).toBe("No. 027");

    renderWidget(root, makeData(), makeHandlers(), false);
    expect(root.querySelector(".num")?.textContent).toBe("");
  });

  it("shrinks a word that is too wide for the card", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, makeData({ word: "uncharacteristically" }), makeHandlers(), false);
    const card = root.querySelector(".card") as HTMLElement;
    const column = card.querySelector(".content") as HTMLElement;
    const wordEl = card.querySelector(".word") as HTMLElement;
    const wordText = card.querySelector(".wordText") as HTMLElement;

    Object.defineProperty(column, "clientWidth", { value: 300, configurable: true });
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      // the text is wider the larger the .word row's font-size is; the row itself always spans the card
      const size = parseInt(wordEl.style.fontSize || "32", 10);
      return { width: this === wordText ? size * 10 : this === wordEl ? 300 : 0, height: 0 } as DOMRect;
    });
    fitWord(card);
    spy.mockRestore();

    expect(wordEl.style.fontSize).toBe("24px");
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
