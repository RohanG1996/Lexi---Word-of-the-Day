// Inline SVG icons for content scripts. Material Icons (a ligature font) is
// deliberately not used here: on pages with a strict Content-Security-Policy,
// the extension's injected Google Fonts <link> can silently fail to load,
// which leaves the literal ligature text ("close", "auto_stories", ...)
// showing instead of an icon. Inline SVG has no external dependency, so it
// renders the same on every page regardless of that page's CSP.

export const ICON_CLOSE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>`;

export const ICON_MINIMIZE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

export const ICON_BOOK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7c-2-2-5-2-8-1v13c3-1 6-1 8 1 2-2 5-2 8-1V6c-3-1-6-1-8 1z"/><path d="M12 7v13"/></svg>`;

export const ICON_CHECK_CIRCLE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`;

export const ICON_CLOSE_THIN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg>`;

export const ICON_BOOKMARK = `<svg width="22" height="25" viewBox="0 0 22 25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4.5 2.5h13v20l-6.5-5.2-6.5 5.2z"/></svg>`;

export const ICON_BOOKMARK_FILLED = `<svg width="22" height="25" viewBox="0 0 22 25" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4.5 2.5h13v20l-6.5-5.2-6.5 5.2z"/></svg>`;

export const ICON_ARROW_RIGHT = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="20" y2="12"/><polyline points="13,5 20,12 13,19"/></svg>`;

export const ICON_MINIMIZE_THIN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/></svg>`;

// Thin line icons for the side panel (extension page, so no CSP concern, but kept inline for consistency).
const LINE = (inner: string, sw = "1.5") =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const ICON_BACK = LINE(`<line x1="20" y1="12" x2="4" y2="12"/><polyline points="11,5 4,12 11,19"/>`);
export const ICON_LIST = LINE(
  `<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><line x1="4" y1="6" x2="4.01" y2="6"/><line x1="4" y1="12" x2="4.01" y2="12"/><line x1="4" y1="18" x2="4.01" y2="18"/>`,
  "2"
);
export const ICON_SEARCH = LINE(`<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>`, "2");
export const ICON_PLUS = LINE(`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`, "2");
export const ICON_SCHOOL = LINE(`<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>`, "1.8");
export const ICON_CHEVRON_DOWN = LINE(`<polyline points="6,9 12,15 18,9"/>`, "1.8");
export const ICON_SETTINGS = LINE(
  `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  "1.6"
);
export const ICON_TRASH = LINE(
  `<polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2 0 0 1-2,2H7a2,2 0 0 1-2-2V6m3,0V4a2,2 0 0 1,2-2h4a2,2 0 0 1,2,2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
  "1.8"
);
// A small filled checkmark drawn separately from ICON_CHECK_CIRCLE (which draws its own circle) - used inside the
// select-mode checkbox squares, where the circle isn't wanted.
export const ICON_CHECK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`;
