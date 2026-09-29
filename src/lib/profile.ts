import type { StorageArea } from "./storage";

const KEY = "lexi.profile"; // sync - the profile follows you across devices

export type GoalId = "communication" | "writing" | "jargon" | "everyday" | "curious";

export interface Goal {
  id: GoalId;
  label: string;
  // The one-line description shown under the goal in onboarding.
  description: string;
}

export const GOALS: Goal[] = [
  { id: "communication", label: "Improve communication", description: "Speak and present with more precision" },
  { id: "writing", label: "Improve writing", description: "Find the right word for emails and documents" },
  { id: "jargon", label: "Learn industry jargon", description: "Keep up with the language of your field" },
  { id: "everyday", label: "Everyday vocabulary", description: "Sound natural and articulate day to day" },
  { id: "curious", label: "Just curious", description: "A good word a day, no agenda" },
];

// Only this goal asks the follow-up "Which industry?" question.
export const INDUSTRY_GOAL: GoalId = "jargon";
export const INDUSTRY_SUGGESTIONS = ["Technology", "Design", "Law", "Finance", "Healthcare"];

export interface Profile {
  // Email of the Google account the browser is signed into; empty when signed out / unavailable.
  email: string;
  name: string;
  arrivalTime: string; // 24h "HH:MM", local time
  goal: GoalId | null;
  industry: string; // only meaningful when goal === INDUSTRY_GOAL
  onboarded: boolean;
}

export const DEFAULT_ARRIVAL_TIME = "08:00";

export const EMPTY_PROFILE: Profile = {
  email: "",
  name: "",
  arrivalTime: DEFAULT_ARRIVAL_TIME,
  goal: null,
  industry: "",
  onboarded: false,
};

export function isGoalId(value: unknown): value is GoalId {
  return GOALS.some((g) => g.id === value);
}

export function goalLabel(id: GoalId | null): string {
  return GOALS.find((g) => g.id === id)?.label ?? "";
}

export function needsIndustry(goal: GoalId | null): boolean {
  return goal === INDUSTRY_GOAL;
}

export interface TimeOption {
  value: string; // "HH:MM"
  label: string; // "8:00 AM"
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// On-the-hour choices from 5:00 AM to 10:00 PM.
export const ARRIVAL_TIMES: TimeOption[] = Array.from({ length: 18 }, (_, i) => {
  const value = `${String(i + 5).padStart(2, "0")}:00`;
  return { value, label: formatTime(value) };
});

export function isArrivalTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// The day's word is held back until the chosen time has passed.
export function hasArrived(now: Date, arrivalTime: string): boolean {
  if (!isArrivalTime(arrivalTime)) return true;
  const [h, m] = arrivalTime.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

// "priya.sharma@gmail.com" -> "Priya": a starting point for the name step, editable there.
export function suggestName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._\-+0-9]/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

export function isProfileComplete(p: Profile): boolean {
  if (!p.name.trim() || !isArrivalTime(p.arrivalTime) || !p.goal) return false;
  return !needsIndustry(p.goal) || p.industry.trim().length > 0;
}

// Text folded into the word-of-the-day prompt so the daily pick suits the reader; undefined when there's nothing to say.
export function profilePreference(p: Profile): string | undefined {
  if (!p.goal) return undefined;
  if (needsIndustry(p.goal) && p.industry.trim()) {
    return `The reader wants to learn the vocabulary and jargon of the ${p.industry.trim()} industry.`;
  }
  const byGoal: Record<GoalId, string> = {
    communication: "The reader wants to speak and present more precisely.",
    writing: "The reader wants to write better emails and documents.",
    jargon: "The reader wants to learn industry jargon.",
    everyday: "The reader wants a broader everyday vocabulary.",
    curious: "The reader is just curious, so any interesting word suits.",
  };
  return byGoal[p.goal];
}

function normalise(value: unknown): Profile {
  const v = (typeof value === "object" && value !== null ? value : {}) as Partial<Profile>;
  return {
    email: typeof v.email === "string" ? v.email : "",
    name: typeof v.name === "string" ? v.name : "",
    arrivalTime: isArrivalTime(v.arrivalTime) ? v.arrivalTime : DEFAULT_ARRIVAL_TIME,
    goal: isGoalId(v.goal) ? v.goal : null,
    industry: typeof v.industry === "string" ? v.industry : "",
    onboarded: v.onboarded === true,
  };
}

export function createProfileStore(area: StorageArea) {
  async function getProfile(): Promise<Profile> {
    const data = await area.get(KEY);
    return normalise(data[KEY]);
  }
  async function setProfile(profile: Profile): Promise<void> {
    await area.set({ [KEY]: normalise(profile) });
  }
  async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const next = normalise({ ...(await getProfile()), ...patch });
    await area.set({ [KEY]: next });
    return next;
  }
  return { getProfile, setProfile, updateProfile };
}

export const PROFILE_KEY = KEY;
