# Lexi Browser Extension — v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a Chrome (Manifest V3) extension that shows a once-a-day AI-picked word in a dismissible top-right corner widget, lets the user save words from any webpage or by typing them, and lets them review saved words in a searchable list with a lightweight quiz mode.

**Architecture:** All business logic (storage, AI prompt building, daily-trigger decisions, search, quiz ordering) lives in small dependency-injected modules under `src/lib`, `src/popup`, and `src/content`, unit-tested with Vitest without touching real `chrome.*` APIs. Thin "glue" entry points (`background/index.ts`, `content/index.ts`, `popup/index.ts`, `options/index.ts`) wire that tested logic to the real `chrome.storage`, `chrome.contextMenus`, `chrome.tabs`, and `chrome.scripting` APIs and are verified manually by loading the unpacked extension (Task 15) rather than unit tested — there's no good way to unit test MV3 service worker event wiring, and faking that would just test the mocks. Two-tier storage: `chrome.storage.sync` holds compact word records + the shared "today's word" (so all your devices agree on it) and stays under Chrome's sync quota; `chrome.storage.local` holds the full AI-generated meaning/example cache and the per-device "have I shown the widget today" flag, plus the API key (never synced).

**Tech Stack:** TypeScript, esbuild (bundling), Vitest + jsdom (testing), Chrome Manifest V3, Anthropic Claude API called directly from the extension with a user-supplied key.

---

## Before you start

This plan builds directly on the [Lexi PRD](https://claude.ai/code/artifact/7d489ba7-9ce9-47c5-b73e-73d16498a5de) — skim it for the *why* behind each piece; this plan only covers the *how*.

All commands below assume your shell's working directory is `lexi-extension/` (already created and git-initialized).

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `esbuild.config.mjs`
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `src/lib/types.ts`

**Step 1: Init npm project and install dependencies**

```bash
npm init -y
npm install -D typescript vitest jsdom esbuild @types/chrome
```

**Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["chrome", "vitest/globals"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

**Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

**Step 4: Write `esbuild.config.mjs`**

```js
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: [
    "src/background/index.ts",
    "src/content/index.ts",
    "src/popup/index.ts",
    "src/options/index.ts",
  ],
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome110",
});

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/index.html", "dist/popup.html");
cpSync("src/options/index.html", "dist/options.html");

console.log("Built to dist/");
```

**Step 5: Write `manifest.json`**

Content is injected programmatically (`chrome.scripting.executeScript`), never declared statically — so it only runs when the background worker decides to show the widget, not on every page load.

```json
{
  "manifest_version": 3,
  "name": "Lexi",
  "version": "0.1.0",
  "description": "A word of the day, with room to save the ones you find on your own.",
  "permissions": ["storage", "contextMenus", "activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "options_page": "options.html"
}
```

**Step 6: Write `.gitignore`**

```
node_modules/
dist/
```

**Step 7: Write `src/lib/types.ts`**

```ts
export interface CompactWordRecord {
  word: string;
  shortMeaning: string;
  savedDate: string; // ISO date, YYYY-MM-DD
  source: "daily" | "manual";
  quizStats: { seen: number; known: number };
}

export interface FullWordDetail {
  word: string;
  meaning: string;
  example: string;
  cachedAt: string; // ISO date
}
```

**Step 8: Add npm scripts to `package.json`**

Edit the `"scripts"` section to:

```json
"scripts": {
  "build": "node esbuild.config.mjs",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

**Step 9: Verify the toolchain**

Run: `npm test`
Expected: Vitest runs with "No test files found" (not an error) — confirms the runner works before we add real tests.

**Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold project (TypeScript, esbuild, Vitest, manifest)"
```

---

### Task 2: Compact word storage (chrome.storage.sync wrapper)

**Files:**
- Create: `src/lib/storage.ts`
- Create: `tests/mocks/fakeStorageArea.ts`
- Test: `tests/lib/storage.test.ts`

**Step 1: Write the fake storage area test helper**

This stands in for `chrome.storage.sync`/`.local` in every test in this plan — no real `chrome.*` mocking needed anywhere in `src/lib`.

```ts
// tests/mocks/fakeStorageArea.ts
import type { StorageArea } from "../../src/lib/storage";

export function createFakeStorageArea(): StorageArea {
  const data: Record<string, unknown> = {};
  return {
    async get(keys) {
      if (keys === null || keys === undefined) return { ...data };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyList) result[k] = data[k];
      return result;
    },
    async set(items) {
      Object.assign(data, items);
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete data[k];
    },
  };
}
```

**Step 2: Write the failing test**

```ts
// tests/lib/storage.test.ts
import { describe, it, expect } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import type { CompactWordRecord } from "../../src/lib/types";

function makeRecord(word: string): CompactWordRecord {
  return {
    word,
    shortMeaning: "a test meaning",
    savedDate: "2026-09-19",
    source: "manual",
    quizStats: { seen: 0, known: 0 },
  };
}

describe("createWordStore", () => {
  it("saves and retrieves a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    const words = await store.getAllWords();
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("ephemeral");
  });

  it("does not create a duplicate for the same word, case-insensitive", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("Ephemeral"));
    await store.saveWord(makeRecord("ephemeral"));
    expect(await store.getAllWords()).toHaveLength(1);
  });

  it("deletes a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    await store.deleteWord("ephemeral");
    expect(await store.getAllWords()).toHaveLength(0);
  });

  it("updates quiz stats for a word", async () => {
    const store = createWordStore(createFakeStorageArea());
    await store.saveWord(makeRecord("ephemeral"));
    await store.updateQuizStats("ephemeral", true);
    const words = await store.getAllWords();
    expect(words[0].quizStats).toEqual({ seen: 1, known: 1 });
  });
});
```

**Step 3: Run the test to verify it fails**

Run: `npm test -- tests/lib/storage.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/storage'`

**Step 4: Write the implementation**

```ts
// src/lib/storage.ts
import type { CompactWordRecord } from "./types";

const KEY = "lexi.words";

export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export function createWordStore(area: StorageArea) {
  async function getAllWords(): Promise<CompactWordRecord[]> {
    const data = await area.get(KEY);
    return (data[KEY] as CompactWordRecord[]) ?? [];
  }

  async function saveWord(record: CompactWordRecord): Promise<CompactWordRecord> {
    const words = await getAllWords();
    const existing = words.find((w) => w.word.toLowerCase() === record.word.toLowerCase());
    if (existing) return existing;
    await area.set({ [KEY]: [...words, record] });
    return record;
  }

  async function deleteWord(word: string): Promise<void> {
    const words = await getAllWords();
    await area.set({ [KEY]: words.filter((w) => w.word.toLowerCase() !== word.toLowerCase()) });
  }

  async function updateQuizStats(word: string, known: boolean): Promise<void> {
    const words = await getAllWords();
    const updated = words.map((w) =>
      w.word.toLowerCase() === word.toLowerCase()
        ? { ...w, quizStats: { seen: w.quizStats.seen + 1, known: w.quizStats.known + (known ? 1 : 0) } }
        : w
    );
    await area.set({ [KEY]: updated });
  }

  return { getAllWords, saveWord, deleteWord, updateQuizStats };
}
```

**Step 5: Run the test to verify it passes**

Run: `npm test -- tests/lib/storage.test.ts`
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add src/lib/storage.ts src/lib/types.ts tests/lib/storage.test.ts tests/mocks/fakeStorageArea.ts
git commit -m "feat: compact word store with dedupe and quiz stats"
```

---

### Task 3: Full-detail cache (chrome.storage.local wrapper)

**Files:**
- Create: `src/lib/cache.ts`
- Test: `tests/lib/cache.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/cache.test.ts
import { describe, it, expect } from "vitest";
import { createDetailCache } from "../../src/lib/cache";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";

describe("createDetailCache", () => {
  it("returns undefined for a word not yet cached", async () => {
    const cache = createDetailCache(createFakeStorageArea());
    expect(await cache.getDetail("ephemeral")).toBeUndefined();
  });

  it("stores and retrieves a word's full detail, case-insensitively", async () => {
    const cache = createDetailCache(createFakeStorageArea());
    await cache.setDetail({ word: "Ephemeral", meaning: "lasting a short time", example: "It was ephemeral.", cachedAt: "2026-09-19" });
    const detail = await cache.getDetail("ephemeral");
    expect(detail?.meaning).toBe("lasting a short time");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/cache.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/cache'"

**Step 3: Write the implementation**

```ts
// src/lib/cache.ts
import type { FullWordDetail } from "./types";
import type { StorageArea } from "./storage";

const KEY = "lexi.cache";

export function createDetailCache(area: StorageArea) {
  async function getAll(): Promise<Record<string, FullWordDetail>> {
    const data = await area.get(KEY);
    return (data[KEY] as Record<string, FullWordDetail>) ?? {};
  }

  async function getDetail(word: string): Promise<FullWordDetail | undefined> {
    const all = await getAll();
    return all[word.toLowerCase()];
  }

  async function setDetail(detail: FullWordDetail): Promise<void> {
    const all = await getAll();
    all[detail.word.toLowerCase()] = detail;
    await area.set({ [KEY]: all });
  }

  return { getDetail, setDetail };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/cache.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/lib/cache.ts tests/lib/cache.test.ts
git commit -m "feat: local full-detail word cache"
```

---

### Task 4: API key storage + validation

**Files:**
- Create: `src/lib/apiKey.ts`
- Test: `tests/lib/apiKey.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/apiKey.test.ts
import { describe, it, expect } from "vitest";
import { createApiKeyStore, isPlausibleApiKey } from "../../src/lib/apiKey";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";

describe("createApiKeyStore", () => {
  it("returns null when no key has been set", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    expect(await store.getApiKey()).toBeNull();
  });

  it("stores and retrieves the key", async () => {
    const store = createApiKeyStore(createFakeStorageArea());
    await store.setApiKey("sk-ant-abc123");
    expect(await store.getApiKey()).toBe("sk-ant-abc123");
  });
});

describe("isPlausibleApiKey", () => {
  it("accepts a key with the expected prefix", () => {
    expect(isPlausibleApiKey("sk-ant-abc123")).toBe(true);
  });

  it("rejects an empty or malformed key", () => {
    expect(isPlausibleApiKey("")).toBe(false);
    expect(isPlausibleApiKey("not-a-key")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/apiKey.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/apiKey'"

**Step 3: Write the implementation**

```ts
// src/lib/apiKey.ts
import type { StorageArea } from "./storage";

const KEY = "lexi.apiKey";

export function createApiKeyStore(area: StorageArea) {
  async function getApiKey(): Promise<string | null> {
    const data = await area.get(KEY);
    return (data[KEY] as string) ?? null;
  }
  async function setApiKey(key: string): Promise<void> {
    await area.set({ [KEY]: key });
  }
  return { getApiKey, setApiKey };
}

export function isPlausibleApiKey(key: string): boolean {
  return /^sk-ant-/.test(key.trim());
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/apiKey.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/lib/apiKey.ts tests/lib/apiKey.test.ts
git commit -m "feat: local API key storage and format validation"
```

---

### Task 5: Daily trigger decision logic

**Files:**
- Create: `src/lib/trigger.ts`
- Test: `tests/lib/trigger.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/trigger.test.ts
import { describe, it, expect } from "vitest";
import { shouldShowWidgetToday } from "../../src/lib/trigger";

describe("shouldShowWidgetToday", () => {
  it("shows when nothing has been shown yet", () => {
    expect(shouldShowWidgetToday(null, "2026-09-19")).toBe(true);
  });

  it("does not show again the same day", () => {
    expect(shouldShowWidgetToday("2026-09-19", "2026-09-19")).toBe(false);
  });

  it("shows again on a new day", () => {
    expect(shouldShowWidgetToday("2026-09-18", "2026-09-19")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/trigger.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/trigger'"

**Step 3: Write the implementation**

```ts
// src/lib/trigger.ts
export function shouldShowWidgetToday(lastShownDate: string | null, today: string): boolean {
  return lastShownDate !== today;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/trigger.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/trigger.ts tests/lib/trigger.test.ts
git commit -m "feat: pure once-per-calendar-day trigger decision"
```

---

### Task 6: Claude API client

**Files:**
- Create: `src/lib/claudeClient.ts`
- Test: `tests/lib/claudeClient.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/claudeClient.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExplainPrompt,
  parseExplainResponse,
  buildWordOfDayPrompt,
  parseWordOfDayResponse,
  createClaudeClient,
} from "../../src/lib/claudeClient";

describe("prompt builders and parsers", () => {
  it("includes the word in the explain prompt", () => {
    expect(buildExplainPrompt("ephemeral")).toContain("ephemeral");
  });

  it("parses a valid explain response", () => {
    const result = parseExplainResponse('{"meaning":"lasting a short time","example":"It was ephemeral."}');
    expect(result).toEqual({ meaning: "lasting a short time", example: "It was ephemeral." });
  });

  it("throws on a malformed explain response", () => {
    expect(() => parseExplainResponse('{"meaning":"only"}')).toThrow();
  });

  it("excludes previously used words from the word-of-day prompt", () => {
    const prompt = buildWordOfDayPrompt(["ephemeral", "lucid"]);
    expect(prompt).toContain("ephemeral");
    expect(prompt).toContain("lucid");
  });

  it("parses and trims a valid word-of-day response", () => {
    expect(parseWordOfDayResponse('{"word":" lucid "}')).toBe("lucid");
  });

  it("throws on a malformed word-of-day response", () => {
    expect(() => parseWordOfDayResponse('{"word":""}')).toThrow();
  });
});

describe("createClaudeClient", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("explainWord calls the API and returns the parsed explanation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"meaning":"m","example":"e"}' }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createClaudeClient("sk-ant-test");
    const result = await client.explainWord("ephemeral");

    expect(result).toEqual({ meaning: "m", example: "e" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the API responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const client = createClaudeClient("sk-ant-test");
    await expect(client.explainWord("ephemeral")).rejects.toThrow("401");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/claudeClient.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/claudeClient'"

**Step 3: Write the implementation**

```ts
// src/lib/claudeClient.ts
export interface WordExplanation {
  meaning: string;
  example: string;
}

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";

export function buildExplainPrompt(word: string): string {
  return `Give a concise dictionary-style meaning (max 20 words) and one natural example sentence for the word "${word}". Respond as JSON: {"meaning": "...", "example": "..."}. No other text.`;
}

export function parseExplainResponse(raw: string): WordExplanation {
  const parsed = JSON.parse(raw);
  if (typeof parsed.meaning !== "string" || typeof parsed.example !== "string") {
    throw new Error("Malformed explanation response");
  }
  return { meaning: parsed.meaning, example: parsed.example };
}

export function buildWordOfDayPrompt(previousWords: string[]): string {
  const exclude = previousWords.length
    ? ` Avoid these already-used words: ${previousWords.join(", ")}.`
    : "";
  return `Pick one interesting English word suitable for a "word of the day" feature (moderately advanced, not obscure jargon).${exclude} Respond as JSON: {"word": "..."}. No other text.`;
}

export function parseWordOfDayResponse(raw: string): string {
  const parsed = JSON.parse(raw);
  if (typeof parsed.word !== "string" || !parsed.word.trim()) {
    throw new Error("Malformed word-of-day response");
  }
  return parsed.word.trim();
}

export interface ClaudeClient {
  explainWord(word: string): Promise<WordExplanation>;
  pickWordOfDay(previousWords: string[]): Promise<string>;
}

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text as string;
}

export function createClaudeClient(apiKey: string): ClaudeClient {
  return {
    async explainWord(word: string) {
      return parseExplainResponse(await callClaude(apiKey, buildExplainPrompt(word)));
    },
    async pickWordOfDay(previousWords: string[]) {
      return parseWordOfDayResponse(await callClaude(apiKey, buildWordOfDayPrompt(previousWords)));
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/claudeClient.test.ts`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/lib/claudeClient.ts tests/lib/claudeClient.test.ts
git commit -m "feat: Claude API client with prompt builders and response parsing"
```

*Note: pin `MODEL` to whatever the current generally-available Claude model id is at build time — check the model's own docs rather than trusting this string to stay current.*

---

### Task 7: Word-of-day orchestration

**Files:**
- Create: `src/lib/dailyWord.ts`
- Create: `src/lib/wordOfDayService.ts`
- Test: `tests/lib/wordOfDayService.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/wordOfDayService.test.ts
import { describe, it, expect, vi } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createDetailCache } from "../../src/lib/cache";
import { createTodayWordStore, createLastShownStore } from "../../src/lib/dailyWord";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import { ensureTodayWord, shouldInjectWidget, markWidgetShown } from "../../src/lib/wordOfDayService";
import type { ClaudeClient } from "../../src/lib/claudeClient";

function makeDeps(today: string) {
  const wordStore = createWordStore(createFakeStorageArea());
  const detailCache = createDetailCache(createFakeStorageArea());
  const todayWordStore = createTodayWordStore(createFakeStorageArea());
  const lastShownStore = createLastShownStore(createFakeStorageArea());
  const claude: ClaudeClient = {
    pickWordOfDay: vi.fn().mockResolvedValue("lucid"),
    explainWord: vi.fn().mockResolvedValue({ meaning: "clear-headed", example: "A lucid explanation." }),
  };
  return {
    claude,
    wordStore,
    detailCache,
    todayWordStore,
    lastShownStore,
    todayDate: () => today,
  };
}

describe("ensureTodayWord", () => {
  it("picks and saves a new word the first time it's called that day", async () => {
    const deps = makeDeps("2026-09-19");
    const result = await deps.claude && (await ensureTodayWord(deps));
    expect(result).toEqual({ date: "2026-09-19", word: "lucid" });
    expect(deps.claude.pickWordOfDay).toHaveBeenCalledOnce();
    expect((await deps.wordStore.getAllWords())[0].source).toBe("daily");
  });

  it("does not call Claude again the same day", async () => {
    const deps = makeDeps("2026-09-19");
    await ensureTodayWord(deps);
    await ensureTodayWord(deps);
    expect(deps.claude.pickWordOfDay).toHaveBeenCalledOnce();
  });

  it("excludes only previously shown daily words from the prompt history", async () => {
    const deps = makeDeps("2026-09-19");
    await deps.wordStore.saveWord({
      word: "ephemeral",
      shortMeaning: "m",
      savedDate: "2026-09-18",
      source: "daily",
      quizStats: { seen: 0, known: 0 },
    });
    await deps.wordStore.saveWord({
      word: "manual-word",
      shortMeaning: "m",
      savedDate: "2026-09-18",
      source: "manual",
      quizStats: { seen: 0, known: 0 },
    });
    await ensureTodayWord(deps);
    expect(deps.claude.pickWordOfDay).toHaveBeenCalledWith(["ephemeral"]);
  });
});

describe("shouldInjectWidget / markWidgetShown", () => {
  it("shows the first time, then not again the same day, then again the next day", async () => {
    const deps = makeDeps("2026-09-19");
    expect(await shouldInjectWidget(deps)).toBe(true);
    await markWidgetShown(deps);
    expect(await shouldInjectWidget(deps)).toBe(false);

    const nextDayDeps = { ...deps, todayDate: () => "2026-09-20" };
    expect(await shouldInjectWidget(nextDayDeps)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/wordOfDayService.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/dailyWord'"

**Step 3: Write `src/lib/dailyWord.ts`**

```ts
import type { StorageArea } from "./storage";

const TODAY_WORD_KEY = "lexi.todayWord"; // sync — shared across your devices
const LAST_SHOWN_KEY = "lexi.lastShownDate"; // local — per device

export interface TodayWordRecord {
  date: string;
  word: string;
}

export function createTodayWordStore(syncArea: StorageArea) {
  async function getTodayWord(): Promise<TodayWordRecord | null> {
    const data = await syncArea.get(TODAY_WORD_KEY);
    return (data[TODAY_WORD_KEY] as TodayWordRecord) ?? null;
  }
  async function setTodayWord(record: TodayWordRecord): Promise<void> {
    await syncArea.set({ [TODAY_WORD_KEY]: record });
  }
  return { getTodayWord, setTodayWord };
}

export function createLastShownStore(localArea: StorageArea) {
  async function getLastShownDate(): Promise<string | null> {
    const data = await localArea.get(LAST_SHOWN_KEY);
    return (data[LAST_SHOWN_KEY] as string) ?? null;
  }
  async function setLastShownDate(date: string): Promise<void> {
    await localArea.set({ [LAST_SHOWN_KEY]: date });
  }
  return { getLastShownDate, setLastShownDate };
}
```

**Step 4: Write `src/lib/wordOfDayService.ts`**

```ts
import type { ClaudeClient } from "./claudeClient";
import type { CompactWordRecord } from "./types";
import type { TodayWordRecord } from "./dailyWord";
import { shouldShowWidgetToday } from "./trigger";

export interface WordOfDayDeps {
  claude: ClaudeClient;
  todayWordStore: {
    getTodayWord(): Promise<TodayWordRecord | null>;
    setTodayWord(r: TodayWordRecord): Promise<void>;
  };
  lastShownStore: {
    getLastShownDate(): Promise<string | null>;
    setLastShownDate(date: string): Promise<void>;
  };
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    saveWord(r: CompactWordRecord): Promise<CompactWordRecord>;
  };
  detailCache: {
    setDetail(d: { word: string; meaning: string; example: string; cachedAt: string }): Promise<void>;
  };
  todayDate: () => string;
}

export async function ensureTodayWord(deps: WordOfDayDeps): Promise<TodayWordRecord> {
  const today = deps.todayDate();
  const existing = await deps.todayWordStore.getTodayWord();
  if (existing && existing.date === today) return existing;

  const history = (await deps.wordStore.getAllWords())
    .filter((w) => w.source === "daily")
    .map((w) => w.word);

  const word = await deps.claude.pickWordOfDay(history);
  const explanation = await deps.claude.explainWord(word);

  await deps.wordStore.saveWord({
    word,
    shortMeaning: explanation.meaning,
    savedDate: today,
    source: "daily",
    quizStats: { seen: 0, known: 0 },
  });
  await deps.detailCache.setDetail({ word, meaning: explanation.meaning, example: explanation.example, cachedAt: today });

  const record = { date: today, word };
  await deps.todayWordStore.setTodayWord(record);
  return record;
}

export async function shouldInjectWidget(deps: Pick<WordOfDayDeps, "lastShownStore" | "todayDate">): Promise<boolean> {
  return shouldShowWidgetToday(await deps.lastShownStore.getLastShownDate(), deps.todayDate());
}

export async function markWidgetShown(deps: Pick<WordOfDayDeps, "lastShownStore" | "todayDate">): Promise<void> {
  await deps.lastShownStore.setLastShownDate(deps.todayDate());
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/lib/wordOfDayService.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/lib/dailyWord.ts src/lib/wordOfDayService.ts tests/lib/wordOfDayService.test.ts
git commit -m "feat: word-of-day orchestration with once-per-day caching"
```

---

### Task 8: Add-word flow

**Files:**
- Create: `src/lib/addWord.ts`
- Test: `tests/lib/addWord.test.ts`

**Step 1: Write the failing test**

```ts
// tests/lib/addWord.test.ts
import { describe, it, expect, vi } from "vitest";
import { createWordStore } from "../../src/lib/storage";
import { createDetailCache } from "../../src/lib/cache";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import { addWord } from "../../src/lib/addWord";
import type { ClaudeClient } from "../../src/lib/claudeClient";

function makeDeps() {
  const wordStore = createWordStore(createFakeStorageArea());
  const detailCache = createDetailCache(createFakeStorageArea());
  const claude: ClaudeClient = {
    pickWordOfDay: vi.fn(),
    explainWord: vi.fn().mockResolvedValue({ meaning: "lasting a short time", example: "It was ephemeral." }),
  };
  return { claude, wordStore, detailCache, today: () => "2026-09-19" };
}

describe("addWord", () => {
  it("throws on an empty word", async () => {
    await expect(addWord(makeDeps(), "   ")).rejects.toThrow();
  });

  it("explains and saves a new word", async () => {
    const deps = makeDeps();
    const record = await addWord(deps, "ephemeral");
    expect(record.shortMeaning).toBe("lasting a short time");
    expect(record.source).toBe("manual");
    expect(deps.claude.explainWord).toHaveBeenCalledWith("ephemeral");
  });

  it("returns the existing record for a duplicate without calling Claude again", async () => {
    const deps = makeDeps();
    await addWord(deps, "ephemeral");
    await addWord(deps, "Ephemeral");
    expect(deps.claude.explainWord).toHaveBeenCalledOnce();
    expect(await deps.wordStore.getAllWords()).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/addWord.test.ts`
Expected: FAIL with "Cannot find module '../../src/lib/addWord'"

**Step 3: Write the implementation**

```ts
// src/lib/addWord.ts
import type { ClaudeClient } from "./claudeClient";
import type { CompactWordRecord } from "./types";

export interface AddWordDeps {
  claude: ClaudeClient;
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    saveWord(r: CompactWordRecord): Promise<CompactWordRecord>;
  };
  detailCache: {
    setDetail(d: { word: string; meaning: string; example: string; cachedAt: string }): Promise<void>;
  };
  today: () => string;
}

export async function addWord(deps: AddWordDeps, rawWord: string): Promise<CompactWordRecord> {
  const word = rawWord.trim();
  if (!word) throw new Error("Empty word");

  const existing = (await deps.wordStore.getAllWords()).find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );
  if (existing) return existing;

  const explanation = await deps.claude.explainWord(word);
  const record: CompactWordRecord = {
    word,
    shortMeaning: explanation.meaning,
    savedDate: deps.today(),
    source: "manual",
    quizStats: { seen: 0, known: 0 },
  };
  await deps.wordStore.saveWord(record);
  await deps.detailCache.setDetail({ word, meaning: explanation.meaning, example: explanation.example, cachedAt: deps.today() });
  return record;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/addWord.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/addWord.ts tests/lib/addWord.test.ts
git commit -m "feat: add-word flow shared by context menu and popup"
```

---

### Task 9: Content script widget (shadow DOM)

**Files:**
- Create: `src/content/widget.ts`
- Create: `src/content/index.ts`
- Test: `tests/content/widget.test.ts`

**Step 1: Write the failing test**

```ts
// tests/content/widget.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/content/widget.test.ts`
Expected: FAIL with "Cannot find module '../../src/content/widget'"

**Step 3: Write `src/content/widget.ts`**

```ts
export interface WidgetData {
  word: string;
  meaning: string;
  example: string;
}

export function renderWidget(root: ShadowRoot, data: WidgetData, onClose: () => void): void {
  root.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = `
    .card { position: fixed; top: 16px; right: 16px; width: 260px; background: #fff; color: #1a1a1a;
      border: 1px solid #ddd; border-radius: 12px; padding: 16px; font-family: sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 2147483647; }
    .word { font-weight: 600; font-size: 16px; margin: 0 0 4px; }
    .meaning { font-size: 13px; margin: 0 0 8px; color: #333; }
    .example { font-size: 12px; font-style: italic; color: #555; margin: 0; }
    .close { position: absolute; top: 8px; right: 10px; cursor: pointer; border: none; background: none; font-size: 14px; }
  `;

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <p class="word"></p>
    <p class="meaning"></p>
    <p class="example"></p>
  `;
  card.querySelector(".word")!.textContent = data.word;
  card.querySelector(".meaning")!.textContent = data.meaning;
  card.querySelector(".example")!.textContent = data.example;
  card.querySelector(".close")!.addEventListener("click", onClose);

  root.appendChild(style);
  root.appendChild(card);
}

export function mountWidget(data: WidgetData): void {
  const host = document.createElement("div");
  host.id = "lexi-widget-host";
  const shadow = host.attachShadow({ mode: "open" });
  document.body.appendChild(host);
  renderWidget(shadow, data, () => host.remove());
}
```

*(Text content is set via `.textContent`, not template-interpolated into `innerHTML`, so a word/meaning/example containing HTML-special characters can't break out of the widget.)*

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/content/widget.test.ts`
Expected: PASS (2 tests)

**Step 5: Write the content script entry point (glue, not unit tested)**

This is the file actually injected by the background worker. It reads whatever the background worker already prepared in storage and mounts the widget — no AI calls, no decision logic, all of that already happened and was tested in Task 7.

```ts
// src/content/index.ts
import { mountWidget } from "./widget";

async function main() {
  const syncData = await chrome.storage.sync.get("lexi.todayWord");
  const today = syncData["lexi.todayWord"] as { date: string; word: string } | undefined;
  if (!today) return;

  const localData = await chrome.storage.local.get("lexi.cache");
  const cache = (localData["lexi.cache"] as Record<string, { meaning: string; example: string }>) ?? {};
  const detail = cache[today.word.toLowerCase()];
  if (!detail) return;

  mountWidget({ word: today.word, meaning: detail.meaning, example: detail.example });
}

main();
```

**Step 6: Commit**

```bash
git add src/content/widget.ts src/content/index.ts tests/content/widget.test.ts
git commit -m "feat: shadow-DOM corner widget"
```

---

### Task 10: Background service worker wiring (glue, manually verified)

**Files:**
- Create: `src/background/index.ts`

This task has no automated test — it's wiring already-tested pure functions (`ensureTodayWord`, `shouldInjectWidget`, `markWidgetShown`, `addWord`) to real `chrome.*` event listeners, which only run inside an actual loaded extension. It's verified in Task 15.

**Step 1: Write `src/background/index.ts`**

```ts
import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createTodayWordStore, createLastShownStore } from "../lib/dailyWord";
import { createClaudeClient } from "../lib/claudeClient";
import { ensureTodayWord, shouldInjectWidget, markWidgetShown } from "../lib/wordOfDayService";
import { addWord } from "../lib/addWord";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getDeps() {
  const apiKeyStore = createApiKeyStore(chrome.storage.local);
  const apiKey = await apiKeyStore.getApiKey();
  return {
    apiKey,
    claude: apiKey ? createClaudeClient(apiKey) : null,
    wordStore: createWordStore(chrome.storage.sync),
    detailCache: createDetailCache(chrome.storage.local),
    todayWordStore: createTodayWordStore(chrome.storage.sync),
    lastShownStore: createLastShownStore(chrome.storage.local),
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lexi-add-word",
    title: "Add to Lexi",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== "lexi-add-word" || !info.selectionText) return;
  const deps = await getDeps();
  if (!deps.claude) return; // no API key set yet — see options page
  await addWord(
    { claude: deps.claude, wordStore: deps.wordStore, detailCache: deps.detailCache, today: todayISO },
    info.selectionText
  );
});

async function maybeShowWidget(tabId: number) {
  const deps = await getDeps();
  if (!deps.claude) return;

  if (!(await shouldInjectWidget({ lastShownStore: deps.lastShownStore, todayDate: todayISO }))) return;

  await ensureTodayWord({
    claude: deps.claude,
    todayWordStore: deps.todayWordStore,
    lastShownStore: deps.lastShownStore,
    wordStore: deps.wordStore,
    detailCache: deps.detailCache,
    todayDate: todayISO,
  });

  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  await markWidgetShown({ lastShownStore: deps.lastShownStore, todayDate: todayISO });
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  maybeShowWidget(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id !== undefined) maybeShowWidget(tab.id);
});
```

**Step 2: Build and confirm no compile errors**

Run: `npm run build`
Expected: `dist/background.js` produced with no esbuild/type errors.

**Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: background service worker — context menu and daily widget trigger"
```

---

### Task 11: Popup — search over saved words

**Files:**
- Create: `src/popup/search.ts`
- Test: `tests/popup/search.test.ts`

**Step 1: Write the failing test**

```ts
// tests/popup/search.test.ts
import { describe, it, expect } from "vitest";
import { filterWords } from "../../src/popup/search";
import type { CompactWordRecord } from "../../src/lib/types";

const words: CompactWordRecord[] = [
  { word: "ephemeral", shortMeaning: "lasting a short time", savedDate: "2026-09-18", source: "daily", quizStats: { seen: 0, known: 0 } },
  { word: "lucid", shortMeaning: "clear and easy to understand", savedDate: "2026-09-19", source: "manual", quizStats: { seen: 0, known: 0 } },
];

describe("filterWords", () => {
  it("returns everything for an empty query", () => {
    expect(filterWords(words, "")).toHaveLength(2);
  });

  it("matches by the word itself", () => {
    expect(filterWords(words, "luc").map((w) => w.word)).toEqual(["lucid"]);
  });

  it("matches by meaning, even when the word itself doesn't match", () => {
    expect(filterWords(words, "short time").map((w) => w.word)).toEqual(["ephemeral"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterWords(words, "xyz")).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/popup/search.test.ts`
Expected: FAIL with "Cannot find module '../../src/popup/search'"

**Step 3: Write the implementation**

```ts
// src/popup/search.ts
import type { CompactWordRecord } from "../lib/types";

export function filterWords(words: CompactWordRecord[], query: string): CompactWordRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return words;
  return words.filter(
    (w) => w.word.toLowerCase().includes(q) || w.shortMeaning.toLowerCase().includes(q)
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/popup/search.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/popup/search.ts tests/popup/search.test.ts
git commit -m "feat: search saved words by word or meaning"
```

---

### Task 12: Quiz ordering

**Files:**
- Create: `src/popup/quiz.ts`
- Test: `tests/popup/quiz.test.ts`

**Step 1: Write the failing test**

```ts
// tests/popup/quiz.test.ts
import { describe, it, expect } from "vitest";
import { pickNextQuizWord } from "../../src/popup/quiz";
import type { CompactWordRecord } from "../../src/lib/types";

function word(w: string, seen: number, known: number): CompactWordRecord {
  return { word: w, shortMeaning: "m", savedDate: "2026-09-19", source: "manual", quizStats: { seen, known } };
}

describe("pickNextQuizWord", () => {
  it("returns null for an empty list", () => {
    expect(pickNextQuizWord([])).toBeNull();
  });

  it("prioritizes a never-seen word over one already known", () => {
    const words = [word("mastered", 5, 5), word("new", 0, 0)];
    expect(pickNextQuizWord(words)?.word).toBe("new");
  });

  it("prioritizes a word with a lower known ratio", () => {
    const words = [word("shaky", 4, 1), word("solid", 4, 4)];
    expect(pickNextQuizWord(words)?.word).toBe("shaky");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/popup/quiz.test.ts`
Expected: FAIL with "Cannot find module '../../src/popup/quiz'"

**Step 3: Write the implementation**

```ts
// src/popup/quiz.ts
import type { CompactWordRecord } from "../lib/types";

export function pickNextQuizWord(words: CompactWordRecord[]): CompactWordRecord | null {
  if (words.length === 0) return null;
  const priority = (w: CompactWordRecord) =>
    w.quizStats.seen === 0 ? -1 : w.quizStats.known / w.quizStats.seen;
  return [...words].sort((a, b) => priority(a) - priority(b))[0];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/popup/quiz.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/popup/quiz.ts tests/popup/quiz.test.ts
git commit -m "feat: quiz ordering prioritizing unseen and weak words"
```

---

### Task 13: Popup UI wiring (glue, manually verified)

**Files:**
- Create: `src/popup/index.html`
- Create: `src/popup/index.ts`

No new automated tests — this wires the already-tested `filterWords`, `pickNextQuizWord`, and `addWord` to the DOM. Verified in Task 15.

**Step 1: Write `src/popup/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Lexi</title>
    <style>
      body { width: 320px; font-family: sans-serif; padding: 12px; margin: 0; }
      input, button { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 6px; font-size: 13px; }
      .item { border-bottom: 1px solid #eee; padding: 6px 0; }
      .item .w { font-weight: 600; }
      .item .m { color: #555; font-size: 12px; }
      .del { float: right; cursor: pointer; color: #a33; }
      #quiz { border-top: 1px solid #eee; padding-top: 8px; }
      .err { color: #a33; font-size: 12px; }
    </style>
  </head>
  <body>
    <input id="search" placeholder="Search your words..." />
    <div id="list"></div>

    <hr />
    <input id="newWord" placeholder="Add a word..." />
    <button id="addBtn">Add</button>
    <div id="addErr" class="err"></div>

    <hr />
    <button id="quizBtn">Quiz me</button>
    <div id="quiz"></div>

    <script src="popup.js"></script>
  </body>
</html>
```

**Step 2: Write `src/popup/index.ts`**

```ts
import { createWordStore } from "../lib/storage";
import { createDetailCache } from "../lib/cache";
import { createApiKeyStore } from "../lib/apiKey";
import { createClaudeClient } from "../lib/claudeClient";
import { addWord } from "../lib/addWord";
import { filterWords } from "./search";
import { pickNextQuizWord } from "./quiz";
import type { CompactWordRecord } from "../lib/types";

const wordStore = createWordStore(chrome.storage.sync);
const detailCache = createDetailCache(chrome.storage.local);
const today = () => new Date().toISOString().slice(0, 10);

const searchInput = document.getElementById("search") as HTMLInputElement;
const listEl = document.getElementById("list") as HTMLDivElement;
const newWordInput = document.getElementById("newWord") as HTMLInputElement;
const addBtn = document.getElementById("addBtn") as HTMLButtonElement;
const addErr = document.getElementById("addErr") as HTMLDivElement;
const quizBtn = document.getElementById("quizBtn") as HTMLButtonElement;
const quizEl = document.getElementById("quiz") as HTMLDivElement;

async function renderList() {
  const all = await wordStore.getAllWords();
  const matches = filterWords(all, searchInput.value);
  listEl.innerHTML = "";
  for (const w of matches) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `<span class="del" data-word="${w.word}">✕</span><div class="w"></div><div class="m"></div>`;
    row.querySelector(".w")!.textContent = w.word;
    row.querySelector(".m")!.textContent = w.shortMeaning;
    row.querySelector(".del")!.addEventListener("click", async () => {
      await wordStore.deleteWord(w.word);
      renderList();
    });
    listEl.appendChild(row);
  }
}

searchInput.addEventListener("input", renderList);

addBtn.addEventListener("click", async () => {
  addErr.textContent = "";
  const apiKey = await createApiKeyStore(chrome.storage.local).getApiKey();
  if (!apiKey) {
    addErr.textContent = "Add your API key in Options first.";
    return;
  }
  try {
    await addWord({ claude: createClaudeClient(apiKey), wordStore, detailCache, today }, newWordInput.value);
    newWordInput.value = "";
    renderList();
  } catch (e) {
    addErr.textContent = e instanceof Error ? e.message : "Couldn't add that word.";
  }
});

async function renderQuiz() {
  const all = await wordStore.getAllWords();
  const next = pickNextQuizWord(all);
  quizEl.innerHTML = "";
  if (!next) {
    quizEl.textContent = "No saved words yet.";
    return;
  }
  renderQuizCard(next);
}

function renderQuizCard(w: CompactWordRecord) {
  quizEl.innerHTML = `
    <div class="w"></div>
    <button id="reveal">Reveal meaning</button>
    <div class="m" id="meaning" style="display:none"></div>
    <div id="rate" style="display:none">
      <button id="knew">Knew it</button>
      <button id="didnt">Didn't know it</button>
    </div>
  `;
  quizEl.querySelector(".w")!.textContent = w.word;
  quizEl.querySelector("#meaning")!.textContent = w.shortMeaning;

  quizEl.querySelector("#reveal")!.addEventListener("click", () => {
    (quizEl.querySelector("#meaning") as HTMLElement).style.display = "block";
    (quizEl.querySelector("#rate") as HTMLElement).style.display = "block";
  });

  const rate = async (known: boolean) => {
    await wordStore.updateQuizStats(w.word, known);
    renderQuiz();
  };
  quizEl.querySelector("#knew")!.addEventListener("click", () => rate(true));
  quizEl.querySelector("#didnt")!.addEventListener("click", () => rate(false));
}

quizBtn.addEventListener("click", renderQuiz);

renderList();
```

**Step 3: Build and confirm no compile errors**

Run: `npm run build`
Expected: `dist/popup.js` and `dist/popup.html` produced with no errors.

**Step 4: Commit**

```bash
git add src/popup/index.html src/popup/index.ts
git commit -m "feat: popup UI — saved list, search, add word, quiz"
```

---

### Task 14: Options page — API key entry

**Files:**
- Create: `src/options/index.html`
- Create: `src/options/index.ts`

No new automated test beyond `isPlausibleApiKey` (already covered in Task 4). This wires that validator + `apiKey` store to a form.

**Step 1: Write `src/options/index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Lexi settings</title>
    <style>
      body { font-family: sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
      input, button { padding: 8px; font-size: 14px; }
      input { width: 100%; box-sizing: border-box; margin-bottom: 8px; }
      .err { color: #a33; font-size: 13px; }
      .ok { color: #2a7; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>Lexi settings</h1>
    <p>Paste your Anthropic API key. It's stored only on this device and is never synced.</p>
    <input id="apiKey" type="password" placeholder="sk-ant-..." />
    <button id="save">Save</button>
    <div id="status"></div>
    <script src="options.js"></script>
  </body>
</html>
```

**Step 2: Write `src/options/index.ts`**

```ts
import { createApiKeyStore, isPlausibleApiKey } from "../lib/apiKey";

const store = createApiKeyStore(chrome.storage.local);
const input = document.getElementById("apiKey") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

store.getApiKey().then((key) => {
  if (key) input.value = key;
});

document.getElementById("save")!.addEventListener("click", async () => {
  const key = input.value.trim();
  if (!isPlausibleApiKey(key)) {
    status.className = "err";
    status.textContent = "That doesn't look like a valid Anthropic API key (should start with sk-ant-).";
    return;
  }
  await store.setApiKey(key);
  status.className = "ok";
  status.textContent = "Saved.";
});
```

**Step 3: Build and confirm no compile errors**

Run: `npm run build`
Expected: `dist/options.js` and `dist/options.html` produced with no errors.

**Step 4: Commit**

```bash
git add src/options/index.html src/options/index.ts
git commit -m "feat: options page for API key entry"
```

---

### Task 15: Manual end-to-end verification

**Files:** none — this is a manual QA pass over the built extension.

**Step 1: Full test suite + build**

Run: `npm test`
Expected: all suites PASS (Tasks 2–9, 11, 12 — around 35 tests total)

Run: `npm run build`
Expected: `dist/` contains `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `options.html`, `options.js`

**Step 2: Load the unpacked extension**

1. Open `chrome://extensions`
2. Enable Developer mode (top right)
3. Click "Load unpacked", select the `dist/` folder
4. Confirm Lexi appears with no manifest errors

**Step 3: Set the API key**

1. Right-click the Lexi icon → Options
2. Paste a real Anthropic API key, click Save
3. Confirm "Saved." appears

**Step 4: Verify the daily widget**

1. Switch to any open tab (or open a new one) — the corner widget should appear top-right within a couple seconds, showing a real word/meaning/example
2. Click the ✕ — it disappears
3. Switch tabs again — it should NOT reappear (same day)
4. To simulate a new day without waiting: open the tab's DevTools console and run `chrome.storage.local.remove('lexi.lastShownDate')`, then switch tabs again — it should reappear

**Step 5: Verify add-word via context menu**

1. Select any word on a webpage, right-click → "Add to Lexi"
2. Open the popup — the word should appear in the list with a real AI-generated meaning

**Step 6: Verify manual add + search**

1. In the popup, type a word into "Add a word...", click Add — confirm it appears in the list
2. Type into the search box — confirm it filters by both word and meaning text

**Step 7: Verify quiz mode**

1. Click "Quiz me" — confirm a word appears with a "Reveal meaning" button
2. Click Reveal, then "Knew it" / "Didn't know it" — confirm the next word shown changes based on repeated ratings (mark one word "Didn't know it" a few times and confirm it keeps resurfacing)

**Step 8: Commit the verification**

No code changes — if everything above passed, the MVP is functionally complete. If anything failed, fix it and repeat this task before moving on.

```bash
git log --oneline
```

Expected: a clean sequence of commits from Task 1 through Task 14.

---

## Open items deliberately deferred (see PRD)

- Real icon artwork (manifest currently ships without one)
- Chrome Web Store publishing (host-permission review tradeoff)
- Shared-key backend (needed before any public launch, not before)
- Cross-browser (Firefox/Edge) support
