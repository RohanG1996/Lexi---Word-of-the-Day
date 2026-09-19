import { describe, it, expect, vi } from "vitest";
import { renderWidget } from "../../src/content/widget";

describe("renderWidget", () => {
  it("renders the word, meaning, and example", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    renderWidget(root, { word: "ephemeral", meaning: "lasting a short time", example: "The joy was ephemeral." }, () => {});

    expect(root.querySelector(".word")?.textContent).toBe("ephemeral");
    expect(root.querySelector(".meaning")?.textContent).toBe("lasting a short time");
    expect(root.querySelector(".example")?.textContent).toBe("The joy was ephemeral.");
  });

  it("calls onClose when the close button is clicked", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onClose = vi.fn();
    renderWidget(root, { word: "ephemeral", meaning: "m", example: "e" }, onClose);

    (root.querySelector(".close") as HTMLElement).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
