import { describe, it, expect, vi } from "vitest";
import { renderWidget } from "../../src/content/widget";

function makeHandlers() {
  return { onClose: vi.fn(), onToggleCollapse: vi.fn() };
}

describe("renderWidget", () => {
  it("renders the word, meaning, and example when expanded", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(
      root,
      { word: "ephemeral", meaning: "lasting a short time", example: "The joy was ephemeral." },
      makeHandlers(),
      false
    );

    expect(root.querySelector(".word")?.textContent).toBe("ephemeral");
    expect(root.querySelector(".meaning")?.textContent).toBe("lasting a short time");
    expect(root.querySelector(".example")?.textContent).toBe("The joy was ephemeral.");
  });

  it("calls onClose when the close button is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, { word: "ephemeral", meaning: "m", example: "e" }, handlers, false);

    (root.querySelector(".closeBtn") as HTMLElement).click();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("calls onToggleCollapse when the minimize button is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, { word: "ephemeral", meaning: "m", example: "e" }, handlers, false);

    (root.querySelector(".minimizeBtn") as HTMLElement).click();
    expect(handlers.onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("renders only the word in a pill when collapsed", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, { word: "ephemeral", meaning: "m", example: "e" }, makeHandlers(), true);

    expect(root.querySelector(".pillWord")?.textContent).toBe("ephemeral");
    expect(root.querySelector(".card")).toBeNull();
  });

  it("calls onToggleCollapse when the collapsed pill is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const handlers = makeHandlers();
    renderWidget(root, { word: "ephemeral", meaning: "m", example: "e" }, handlers, true);

    (root.querySelector(".pill") as HTMLElement).click();
    expect(handlers.onToggleCollapse).toHaveBeenCalledOnce();
  });
});
