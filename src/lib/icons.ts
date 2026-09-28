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
