# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lexi is a Chrome Manifest V3 extension: a once-a-day AI-picked word shown in a dismissible, collapsible corner widget, plus the ability to save words (by highlighting them on any page, or typing them in) and review them in a side panel with search and a lightweight quiz. Word explanations and the daily word pick come directly from the Anthropic Claude API, called client-side with a user-supplied API key (no backend).

## Commands

```bash
npm test               # run the full Vitest suite once
npm run test:watch     # Vitest in watch mode
npm test -- tests/lib/storage.test.ts   # run a single test file
npm run build          # bundle with esbuild into dist/ (also copies manifest.json + HTML pages)
```

There is no lint script configured. `tsconfig.json` has `noEmit: true` — type checking happens through the editor/`tsc --noEmit`, not as a build step; `npm run build` only bundles with esbuild and does not type-check.

To manually verify the extension end to end: `npm run build`, then load the `dist/` folder as an unpacked extension via `chrome://extensions` (Developer mode → Load unpacked), set an API key on the options page, and exercise the widget/highlight-to-save/side-panel/quiz flows.

## Architecture

**Split between tested logic and untested glue.** All business logic (storage, prompt building/parsing, daily-trigger decisions, search, quiz ordering) lives in dependency-injected modules under `src/lib`, `src/sidepanel`, and `src/content` (excluding `content/index.ts` and `content/selection.ts`), and is unit-tested with Vitest against a fake storage area — never real `chrome.*` APIs. The entry points (`src/background/index.ts`, `src/content/index.ts`, `src/content/selection.ts`, `src/sidepanel/index.ts`, `src/options/index.ts`) are thin wiring that call the tested functions with real `chrome.storage`/`chrome.contextMenus`/`chrome.tabs`/`chrome.scripting`/`chrome.sidePanel`, and are deliberately *not* unit tested — there's no good way to test MV3 service worker event wiring without just testing mocks (the widget's own render function is the exception — `renderWidget` is a pure DOM-building function taking a ShadowRoot, data, and handlers, so it's tested directly rather than through the page/mount glue). Verify entry-point changes manually via the unpacked-extension flow above. When adding a feature, put the decision logic in `src/lib` (or a `src/sidepanel`/`src/content` helper) with a DI-friendly signature and a test, then wire it into the relevant entry point last.

**No native popup.** The toolbar icon opens a Chrome **side panel** (`chrome.sidePanel`, declared in `manifest.json` under `side_panel.default_path`), not `action.default_popup` — `src/background/index.ts` calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so clicking the icon opens it directly. The side panel reserves real layout space next to the page (as opposed to a transient floating popup), matching the product's "side panel that pushes the page" requirement. `src/sidepanel/index.ts` is a small hand-rolled single-page app (no framework, consistent with the rest of the codebase) that switches between `library` / `search` / `save` / `allWords` / `quiz` views by re-rendering into a single `#app` container — there's no router or separate HTML page per view.

**Two-tier storage**, wrapped by a common `StorageArea` interface (`src/lib/storage.ts`) so `chrome.storage.sync`/`chrome.storage.local` and the test fake (`tests/mocks/fakeStorageArea.ts`) are interchangeable:
- `chrome.storage.sync` — compact word records (`src/lib/storage.ts`, key `lexi.words`) and the shared "today's word" (`src/lib/dailyWord.ts`, key `lexi.todayWord`), so a user's devices agree on the daily word. Kept small to stay under Chrome's sync quota.
- `chrome.storage.local` — the full AI-generated meaning/example cache (`src/lib/cache.ts`, key `lexi.cache`), the per-device "widget already shown today" flag (`src/lib/dailyWord.ts`, key `lexi.lastShownDate`), and the API key (`src/lib/apiKey.ts`, key `lexi.apiKey`) — local/local-only so the key never syncs across devices.

Word records are deduplicated case-insensitively by `word` in `storage.ts`; the same rule is reused wherever a word is looked up (`addWord`, `wordOfDayService`).

**Orchestration layer** (`src/lib/wordOfDayService.ts`, `src/lib/addWord.ts`) composes the lower-level stores and the Claude client:
- `ensureTodayWord` — no-ops if today's word is already cached (by date), otherwise asks Claude for a word (excluding previously-used *daily* words only, not manually-added ones), explains it, and writes it to both storage tiers.
- `shouldInjectWidget` / `markWidgetShown` — wrap the pure `shouldShowWidgetToday` (`src/lib/trigger.ts`) date comparison with the local last-shown-date store.
- `addWord` — shared by the context-menu handler, the highlight-to-save popover, and the side panel's manual-add form; returns the existing record without calling Claude again if the word is already saved.

**Claude client** (`src/lib/claudeClient.ts`) separates pure prompt-building/response-parsing functions (`buildExplainPrompt`, `parseExplainResponse`, `buildWordOfDayPrompt`, `parseWordOfDayResponse` — all directly unit-testable) from `createClaudeClient`, which does the actual `fetch` against `https://api.anthropic.com/v1/messages`. Both API calls request strict JSON-only responses so parsing can throw on malformed output. The model id is a constant (`MODEL` in `claudeClient.ts`) — check Anthropic's docs for the current generally-available model id before assuming it's still correct.

**Background service worker** (`src/background/index.ts`) is the only place that reacts to `chrome.*` events: it creates the "Add to Lexi" context menu on install, sets the side-panel-on-click behavior, calls `addWord` on a context-menu selection, and on tab activation / window focus change calls `maybeShowWidget`, which chains `shouldInjectWidget` → `ensureTodayWord` → `chrome.scripting.executeScript` (injecting `content.js`) → `markWidgetShown`. That widget content script is injected programmatically rather than declared in the manifest, so it only ever runs when the background worker decides to show the widget, not on every page load — unlike `selection.js` (below), which *is* declared in the manifest and runs on every page.

**Content script widget** (`src/content/widget.ts`) renders into a Shadow DOM to avoid CSS collisions with the host page, and always sets rendered word/meaning/example via `.textContent` (never interpolated into `innerHTML`) so page content can't inject HTML into the widget. It's collapsible: clicking the minimize icon re-renders the same shadow root as a small pill showing just the word; clicking that pill re-expands it. `src/content/index.ts` (glue) just reads what the background worker already wrote to storage and mounts the widget — it makes no AI calls and contains no decision logic itself.

**Highlight-to-save content script** (`src/content/selection.ts`) is declared directly in `manifest.json`'s `content_scripts` (matches `<all_urls>`), so — unlike the on-demand widget script — it runs persistently on every page, listening for `mouseup`/selection events. When the user highlights a short run of text outside an editable element, it shows a small Shadow-DOM popover near the selection with an "Add to my library" button that calls the shared `addWord` flow directly (skipped entirely if no API key is set yet). This is the "save a word by highlighting it while browsing" flow, distinct from the existing right-click → "Add to Lexi" context-menu item, which still exists as an alternative entry point into the same `addWord` function.

**Quiz ordering** (`src/sidepanel/quiz.ts`) prioritizes never-seen words, then lowest known/seen ratio, over anything already mastered. It's reachable from the side panel's "All saved words" view, not the main library view.

## Docs

`docs/plans/2026-09-19-lexi-extension-mvp.md` is the original task-by-task implementation plan (referencing a Lexi PRD artifact) and still accurately describes the shipped architecture in full code-level detail — use it as a reference for intended behavior/rationale before changing any of the modules above.
