// One motion language for the whole extension: things ease out (quick start, gentle landing), take a beat to
// settle, and never snap. Every animation here is skipped for people who prefer reduced motion, and quietly does
// nothing where the Web Animations API isn't available (tests / very old browsers), so callers never need a fallback.
//
// CSS-only animations (fades, slides on appearing elements) live next to the styles they belong to and use the same
// numbers: fast 160ms, base 240ms, slow 320ms, and the easing below.

export const MOTION = {
  fast: 160,
  base: 240,
  slow: 320,
  ease: "cubic-bezier(0.22, 0.9, 0.3, 1)",
} as const;

export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAnimate(el: HTMLElement): boolean {
  return !reducedMotion() && typeof el.animate === "function";
}

// Glides an element's height between two values (either may be 0). Padding is animated with it, so a section that
// opens from or closes to 0 doesn't leave its padding behind. Resolves when done; the element keeps its natural
// size afterwards, so callers set the final state (hidden, removed, re-rendered) once it resolves.
export function animateHeight(el: HTMLElement, from: number, to: number, ms: number = MOTION.slow): Promise<void> {
  if (!canAnimate(el) || from === to) return Promise.resolve();
  const cs = getComputedStyle(el);
  const padTop = cs.paddingTop;
  const padBottom = cs.paddingBottom;
  const frame = (h: number): Keyframe => ({
    height: `${h}px`,
    paddingTop: h === 0 ? "0px" : padTop,
    paddingBottom: h === 0 ? "0px" : padBottom,
  });
  const prevOverflow = el.style.overflow;
  el.style.overflow = "hidden";
  const animation = el.animate([frame(from), frame(to)], { duration: ms, easing: MOTION.ease });
  return animation.finished
    .then(
      () => undefined,
      () => undefined
    )
    .then(() => {
      el.style.overflow = prevOverflow;
    });
}

// Fades an element out while its height closes up, then removes it: whatever sits below glides up into the gap
// instead of jumping. Resolves once the element is gone.
export function collapseAndRemove(el: HTMLElement, ms: number = MOTION.slow): Promise<void> {
  if (!canAnimate(el)) {
    el.remove();
    return Promise.resolve();
  }
  const height = el.offsetHeight;
  const prevOverflow = el.style.overflow;
  el.style.overflow = "hidden";
  const animation = el.animate(
    [
      { height: `${height}px`, opacity: 1 },
      { height: "0px", opacity: 0 },
    ],
    { duration: ms, easing: MOTION.ease, fill: "forwards" }
  );
  return animation.finished
    .then(
      () => undefined,
      () => undefined
    )
    .then(() => {
      el.style.overflow = prevOverflow;
      el.remove();
    });
}

// Opens a collapsed section (`hidden` -> visible) with a height glide.
export async function expandSection(el: HTMLElement, ms: number = MOTION.base): Promise<void> {
  el.hidden = false;
  await animateHeight(el, 0, el.offsetHeight, ms);
}

// Closes a section with a height glide, then hides it.
export async function collapseSection(el: HTMLElement, ms: number = MOTION.base): Promise<void> {
  await animateHeight(el, el.offsetHeight, 0, ms);
  el.hidden = true;
}
