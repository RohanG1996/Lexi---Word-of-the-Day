// The Lexi mark: a tilted red square stamp with a serif "L" (final logo "B", tile removed for use on the ivory
// panels). Inline SVG, like icons.ts, so it renders on any page regardless of CSP. The rough "ink" texture is an
// SVG filter; ids are namespaced so several marks (or a host page's own SVGs) never collide.
//
// The extension/toolbar icon is a separate file: the same mark on its ivory tile, rendered to icons/icon-*.png
// from assets/lexi-stamped-outline.svg (Chrome's manifest icons must be PNG).

const L_PATH =
  "M44.80 92.38L44.80 92.38Q43.96 92.38 43.43 92.08Q42.90 91.77 42.90 91.39L42.90 91.39Q42.90 90.78 43.51 90.44Q44.12 90.10 44.50 90.02L44.50 90.02Q47.38 89.34 48.79 88.28Q50.20 87.21 50.20 84.70L50.20 84.70L50.20 49.67Q50.20 47.84 49.82 46.97Q49.44 46.10 48.41 45.64Q47.38 45.18 45.48 44.80L45.48 44.80Q43.28 44.35 43.28 43.28L43.28 43.28Q43.28 42.75 43.85 42.52Q44.42 42.30 45.26 42.30L45.26 42.30Q47.16 42.30 48.68 42.37Q50.20 42.45 51.56 42.52Q52.93 42.60 54.60 42.60L54.60 42.60Q56.35 42.60 57.95 42.56Q59.54 42.52 61.22 42.45Q62.89 42.37 64.79 42.37L64.79 42.37Q65.70 42.37 66.19 42.56Q66.69 42.75 66.69 43.28L66.69 43.28Q66.69 43.89 66.16 44.23Q65.62 44.58 64.48 44.80L64.48 44.80Q61.60 45.49 59.92 46.29Q58.25 47.08 58.25 49.29L58.25 49.29L58.25 84.48Q58.25 86.83 59.28 87.86Q60.30 88.88 63.50 88.88L63.50 88.88L72.31 88.88Q74.29 88.88 75.77 88.28Q77.25 87.67 78.09 86.91L78.09 86.91Q79.53 85.62 80.33 84.44Q81.13 83.26 82.04 81.28L82.04 81.28Q82.42 80.45 82.88 79.69Q83.33 78.93 83.86 78.93L83.86 78.93Q84.40 78.93 84.62 79.42Q84.85 79.92 84.85 80.37L84.85 80.37Q84.85 80.52 84.78 80.75Q84.70 80.98 84.70 81.21L84.70 81.21Q84.17 83.26 83.71 84.86Q83.26 86.45 82.99 87.90Q82.72 89.34 82.57 91.01L82.57 91.01Q82.50 91.54 82.27 91.96Q82.04 92.38 81.43 92.38L81.43 92.38Q78.47 92.38 75.12 92.30Q71.78 92.23 68.36 92.19Q64.94 92.15 61.63 92.08Q58.33 92 55.29 92L55.29 92Q53.46 92 51.22 92.08Q48.98 92.15 47.12 92.27Q45.26 92.38 44.80 92.38Z";

let counter = 0;

export function logoMarkSvg(size: number): string {
  const id = `lexi-rough-${++counter}`;
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 128 128" role="img" aria-label="Lexi" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -0.55" result="m"/>` +
    `<feComposite in="SourceGraphic" in2="m" operator="in" result="t"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed="9" result="w"/>` +
    `<feDisplacementMap in="t" in2="w" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>` +
    `<g filter="url(#${id})" transform="rotate(-8 64 64)">` +
    `<rect x="20" y="20" width="88" height="88" rx="14" fill="none" stroke="#C4574A" stroke-width="6"/>` +
    `<path fill="#C4574A" d="${L_PATH}"/></g></svg>`
  );
}
