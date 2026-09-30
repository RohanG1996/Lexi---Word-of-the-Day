import { describe, it, expect, vi, afterEach } from "vitest";
import { animateHeight, collapseAndRemove, expandSection, collapseSection, MOTION } from "../../src/ui/motion";

function el(height = 100): HTMLElement {
  const node = document.createElement("div");
  Object.defineProperty(node, "offsetHeight", { value: height, configurable: true });
  document.body.appendChild(node);
  return node;
}

function withAnimate(node: HTMLElement) {
  const animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
  (node as unknown as { animate: unknown }).animate = animate;
  return animate;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("motion", () => {
  it("does nothing (and never throws) where the Web Animations API is missing", async () => {
    const node = el();
    await expect(animateHeight(node, 100, 0)).resolves.toBeUndefined();
    await collapseAndRemove(node);
    expect(node.isConnected).toBe(false);
  });

  it("glides the height with the shared easing, then restores overflow", async () => {
    const node = el();
    node.style.overflow = "auto";
    const animate = withAnimate(node);
    await animateHeight(node, 200, 80);
    const [frames, options] = animate.mock.calls[0];
    expect(frames.map((f: { height: string }) => f.height)).toEqual(["200px", "80px"]);
    expect(options).toMatchObject({ duration: MOTION.slow, easing: MOTION.ease });
    expect(node.style.overflow).toBe("auto");
  });

  it("drops padding with the height when closing to zero", async () => {
    const node = el();
    node.style.paddingBottom = "14px";
    const animate = withAnimate(node);
    await animateHeight(node, 100, 0);
    const frames = animate.mock.calls[0][0];
    expect(frames[0].paddingBottom).toBe("14px");
    expect(frames[1].paddingBottom).toBe("0px");
  });

  it("skips the animation when the height does not change", async () => {
    const node = el();
    const animate = withAnimate(node);
    await animateHeight(node, 50, 50);
    expect(animate).not.toHaveBeenCalled();
  });

  it("fades and closes an element up before removing it", async () => {
    const node = el(70);
    const animate = withAnimate(node);
    await collapseAndRemove(node);
    const frames = animate.mock.calls[0][0];
    expect(frames).toEqual([
      { height: "70px", opacity: 1 },
      { height: "0px", opacity: 0 },
    ]);
    expect(node.isConnected).toBe(false);
  });

  it("opens a hidden section and closes it again", async () => {
    const node = el(60);
    node.hidden = true;
    withAnimate(node);
    await expandSection(node);
    expect(node.hidden).toBe(false);
    await collapseSection(node);
    expect(node.hidden).toBe(true);
  });

  it("is skipped entirely for people who prefer reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const node = el();
    const animate = withAnimate(node);
    await animateHeight(node, 100, 0);
    await collapseAndRemove(node);
    expect(animate).not.toHaveBeenCalled();
    expect(node.isConnected).toBe(false);
  });
});
