<p align="center"><img src="icons/icon-128.png" alt="Lexi" width="96" height="96"></p>

# Lexi

A word of the day for Chrome, with room to save the ones you find on your own.

Lexi shows one interesting word a day at the time you choose, lets you save any word by highlighting it on a page, and keeps everything in a searchable library in the browser's side panel.

## What it does

- **Word of the day.** One AI-picked word a day (meaning, pronunciation, part of speech, an example), shown in a small corner card on the page you're on at the time you chose. Choose a goal (better communication, writing, industry jargon, everyday vocabulary) and Lexi picks words to match.
- **Highlight to save.** Select a word on any page and add it to your library from a small popover. A right-click "Add to Lexi" menu does the same.
- **Side panel library.** Click the toolbar icon: your recent words, today's word if you missed it, search with topic filters, an "Add a word" form with a live preview, and multi-select delete.
- **First-run onboarding.** A short pop-up asks for your name, when the word should arrive, and your goal (plus your industry if you want jargon). Everything is editable later in **Settings**.

## Install (from source)

You need a recent version of [Node.js](https://nodejs.org).

```bash
git clone https://github.com/RohanG1996/Lexi---Word-of-the-Day.git
cd Lexi---Word-of-the-Day
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and choose the `dist/` folder.
3. Open any normal web page. The onboarding pop-up appears.

After changing the code, run `npm run build` again and press the reload arrow on Lexi's card in `chrome://extensions`.

### API key

For now Lexi calls an AI provider directly with **your own key** (Anthropic, Google Gemini or Groq). Open the extension's **Options** page (Details → Extension options on its `chrome://extensions` card), pick a provider and paste the key. Until a key is set, words can't be looked up or picked. Keys are stored only on your device (`chrome.storage.local`) and never synced.

## Development

```bash
npm test               # run the test suite once (Vitest)
npm run test:watch     # tests in watch mode
npm run build          # bundle into dist/
npx tsc --noEmit       # type-check (the build does not type-check)
```

Business logic lives in small, dependency-injected modules under `src/lib`, `src/sidepanel` and `src/content` and is unit-tested against a fake storage area. The entry points (`src/background`, `src/content/index.ts`, `selection.ts`, `onboardingEntry.ts`, `src/sidepanel/index.ts`, `src/options`) are thin wiring. `CLAUDE.md` describes the architecture in detail.

```
src/
  background/   service worker: context menu, onboarding, widget timing
  content/      widget, highlight popover, onboarding pop-up (Shadow DOM)
  sidepanel/    library, search, add a word, settings
  lib/          storage, profile, prompts, model clients, logo
  ui/           shared dropdown / goal / industry controls
  options/      API key page
icons/          toolbar and store icons
assets/         logo source files (SVG)
docs/plans/     the original implementation plan
```

## Notes

- Sign-in uses the Google account your browser is already signed into (`chrome.identity`) to read your email only. There is no separate account or server yet.
- Lexi is not on the Chrome Web Store yet.
