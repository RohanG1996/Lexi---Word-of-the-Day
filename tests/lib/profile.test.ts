import { describe, it, expect } from "vitest";
import { createFakeStorageArea } from "../mocks/fakeStorageArea";
import {
  createProfileStore,
  EMPTY_PROFILE,
  ARRIVAL_TIMES,
  formatTime,
  hasArrived,
  suggestName,
  isProfileComplete,
  profilePreference,
  needsIndustry,
} from "../../src/lib/profile";
import { deleteAccountData } from "../../src/lib/account";
import { buildWordOfDayPrompt } from "../../src/lib/prompts";

describe("profile store", () => {
  it("returns an empty, not-onboarded profile when nothing is stored", async () => {
    const store = createProfileStore(createFakeStorageArea());
    expect(await store.getProfile()).toEqual(EMPTY_PROFILE);
  });

  it("round-trips a profile and merges updates", async () => {
    const store = createProfileStore(createFakeStorageArea());
    await store.setProfile({ ...EMPTY_PROFILE, name: "Priya", goal: "writing", onboarded: true });
    const next = await store.updateProfile({ arrivalTime: "09:00" });
    expect(next).toMatchObject({ name: "Priya", goal: "writing", arrivalTime: "09:00", onboarded: true });
    expect(await store.getProfile()).toEqual(next);
  });

  it("falls back to defaults for unrecognised stored values", async () => {
    const area = createFakeStorageArea();
    await area.set({ "lexi.profile": { name: 4, goal: "nope", arrivalTime: "25:99", onboarded: "yes" } });
    expect(await createProfileStore(area).getProfile()).toEqual(EMPTY_PROFILE);
  });
});

describe("arrival time", () => {
  it("formats 24h times as 12h", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("18:00")).toBe("6:00 PM");
  });

  it("offers on-the-hour options from 5 AM to 10 PM", () => {
    expect(ARRIVAL_TIMES[0]).toEqual({ value: "05:00", label: "5:00 AM" });
    expect(ARRIVAL_TIMES.at(-1)).toEqual({ value: "22:00", label: "10:00 PM" });
  });

  it("holds the word back until the chosen time", () => {
    const at = (h: number, m: number) => new Date(2026, 8, 29, h, m);
    expect(hasArrived(at(7, 59), "08:00")).toBe(false);
    expect(hasArrived(at(8, 0), "08:00")).toBe(true);
    expect(hasArrived(at(21, 0), "08:00")).toBe(true);
  });

  it("does not block on a malformed time", () => {
    expect(hasArrived(new Date(2026, 8, 29, 1, 0), "later")).toBe(true);
  });
});

describe("suggestName", () => {
  it("uses the first part of the email", () => {
    expect(suggestName("priya.sharma@gmail.com")).toBe("Priya");
    expect(suggestName("ROHAN_g96@x.com")).toBe("Rohan");
  });
  it("returns empty for no email", () => {
    expect(suggestName("")).toBe("");
  });
});

describe("goals", () => {
  it("only industry jargon asks for an industry", () => {
    expect(needsIndustry("jargon")).toBe(true);
    expect(needsIndustry("writing")).toBe(false);
    expect(needsIndustry(null)).toBe(false);
  });

  it("is complete only with a name, a goal, and an industry when the goal needs one", () => {
    const base = { ...EMPTY_PROFILE, name: "Priya" };
    expect(isProfileComplete(base)).toBe(false);
    expect(isProfileComplete({ ...base, goal: "writing" })).toBe(true);
    expect(isProfileComplete({ ...base, goal: "jargon" })).toBe(false);
    expect(isProfileComplete({ ...base, goal: "jargon", industry: "Law" })).toBe(true);
    expect(isProfileComplete({ ...base, name: "  ", goal: "writing" })).toBe(false);
  });

  it("describes the reader for the prompt, naming the industry when there is one", () => {
    expect(profilePreference(EMPTY_PROFILE)).toBeUndefined();
    expect(profilePreference({ ...EMPTY_PROFILE, goal: "jargon", industry: "Law" })).toContain("Law industry");
    expect(profilePreference({ ...EMPTY_PROFILE, goal: "writing" })).toContain("write");
  });

  it("folds the preference into the word-of-the-day prompt only when given", () => {
    expect(buildWordOfDayPrompt([])).not.toContain("reader");
    expect(buildWordOfDayPrompt([], "The reader wants X.")).toContain("The reader wants X.");
  });
});

describe("deleteAccountData", () => {
  it("clears the profile, library and today's word (sync) and the cache and shown flag (local)", async () => {
    const sync = createFakeStorageArea();
    const local = createFakeStorageArea();
    await sync.set({ "lexi.profile": {}, "lexi.words": [1], "lexi.todayWord": {}, other: 1 });
    await local.set({ "lexi.cache": {}, "lexi.lastShownDate": "2026-09-29", "lexi.apiKey": { key: "k" } });
    await deleteAccountData(sync, local);
    expect(await sync.get(null)).toEqual({ other: 1 });
    expect(await local.get(null)).toEqual({ "lexi.apiKey": { key: "k" } });
  });
});
