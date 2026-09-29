import { describe, it, expect, vi } from "vitest";
import { renderOnboarding, type OnboardingDeps } from "../../src/content/onboarding";
import { EMPTY_PROFILE } from "../../src/lib/profile";

function setup(overrides: Partial<OnboardingDeps> = {}) {
  const deps: OnboardingDeps = {
    initial: EMPTY_PROFILE,
    signIn: vi.fn().mockResolvedValue("priya.sharma@gmail.com"),
    save: vi.fn().mockResolvedValue(undefined),
    onDone: vi.fn(),
    ...overrides,
  };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  renderOnboarding(root, deps);
  return { root, deps };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const q = <T extends Element>(root: ShadowRoot, sel: string) => root.querySelector(sel) as T;
const stepLabel = (root: ShadowRoot) => q(root, ".step").textContent;
const next = (root: ShadowRoot) => q<HTMLButtonElement>(root, ".next");

async function signIn(root: ShadowRoot) {
  q<HTMLButtonElement>(root, ".google").click();
  await tick();
}

describe("onboarding", () => {
  it("starts on the welcome step with the Google sign-in and no Back button", () => {
    const { root } = setup();
    expect(stepLabel(root)).toBe("Step 1 of 4");
    expect(q(root, "h1").textContent).toBe("Welcome to Lexi");
    expect(q(root, ".google").textContent).toContain("Continue with Google");
    expect(root.querySelector(".back")).toBeNull();
  });

  it("signs in, then shows the account and a name suggested from the email", async () => {
    const { root, deps } = setup();
    await signIn(root);
    expect(deps.signIn).toHaveBeenCalledOnce();
    expect(stepLabel(root)).toBe("Step 2 of 4");
    expect(q(root, ".email").textContent).toBe("priya.sharma@gmail.com");
    expect(q<HTMLInputElement>(root, "#lexi-name").value).toBe("Priya");
  });

  it("carries on without an account when sign-in gives no email", async () => {
    const { root } = setup({ signIn: vi.fn().mockResolvedValue(null) });
    await signIn(root);
    expect(stepLabel(root)).toBe("Step 2 of 4");
    expect(root.querySelector(".account")).toBeNull();
    expect(next(root).disabled).toBe(true); // no name yet
  });

  it("'Not you?' drops the account card", async () => {
    const { root } = setup();
    await signIn(root);
    q<HTMLButtonElement>(root, ".notYou").click();
    expect(root.querySelector(".account")).toBeNull();
  });

  it("needs a name to continue", async () => {
    const { root } = setup();
    await signIn(root);
    const input = q<HTMLInputElement>(root, "#lexi-name");
    input.value = "  ";
    input.dispatchEvent(new Event("input"));
    expect(next(root).disabled).toBe(true);
    input.value = "Priya";
    input.dispatchEvent(new Event("input"));
    expect(next(root).disabled).toBe(false);
  });

  it("goes back a step without losing what was typed", async () => {
    const { root } = setup();
    await signIn(root);
    const input = q<HTMLInputElement>(root, "#lexi-name");
    input.value = "Pri";
    input.dispatchEvent(new Event("input"));
    next(root).click();
    expect(stepLabel(root)).toBe("Step 3 of 4");
    q<HTMLButtonElement>(root, ".back").click();
    expect(q<HTMLInputElement>(root, "#lexi-name").value).toBe("Pri");
  });

  it("picks an arrival time from the dropdown", async () => {
    const { root } = setup();
    await signIn(root);
    next(root).click();
    expect(q(root, ".lx-ddValue").textContent).toBe("8:00 AM");
    q<HTMLButtonElement>(root, ".lx-ddTrigger").click();
    const option = Array.from(root.querySelectorAll<HTMLButtonElement>(".lx-ddOption")).find(
      (o) => o.textContent === "9:00 AM"
    )!;
    option.click();
    expect(q(root, ".lx-ddValue").textContent).toBe("9:00 AM");
    expect(q(root, ".lx-help").textContent).toContain("9:00 AM");
  });

  async function toGoalStep(root: ShadowRoot) {
    await signIn(root);
    next(root).click(); // name -> time
    next(root).click(); // time -> goal
    expect(stepLabel(root)).toBe("Step 4 of 4");
  }

  const goalRow = (root: ShadowRoot, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>(".lx-goal")).find((r) => r.textContent!.includes(label))!;

  it("lists the five goals and can't finish until one is chosen", async () => {
    const { root } = setup();
    await toGoalStep(root);
    expect(root.querySelectorAll(".lx-goal")).toHaveLength(5);
    expect(next(root).textContent).toBe("Start learning");
    expect(next(root).disabled).toBe(true);
    goalRow(root, "Improve writing").click();
    expect(next(root).disabled).toBe(false);
    expect(root.querySelector(".lx-industry")).toBeNull();
  });

  it("asks for an industry right under 'Learn industry jargon', and needs it to finish", async () => {
    const { root } = setup();
    await toGoalStep(root);
    goalRow(root, "Learn industry jargon").click();
    const rows = Array.from(root.querySelector(".lx-goals")!.children);
    const jargonAt = rows.findIndex((r) => r.textContent!.includes("Learn industry jargon"));
    expect(rows[jargonAt + 1].classList.contains("lx-industry")).toBe(true);
    expect(next(root).disabled).toBe(true);

    Array.from(root.querySelectorAll<HTMLButtonElement>(".lx-chip")).find((c) => c.textContent === "Law")!.click();
    expect(q<HTMLInputElement>(root, ".lx-industry input").value).toBe("Law");
    expect(next(root).disabled).toBe(false);
  });

  it("saves the finished profile and closes", async () => {
    const { root, deps } = setup();
    await toGoalStep(root);
    goalRow(root, "Learn industry jargon").click();
    Array.from(root.querySelectorAll<HTMLButtonElement>(".lx-chip")).find((c) => c.textContent === "Technology")!.click();
    next(root).click();
    await tick();
    expect(deps.save).toHaveBeenCalledWith({
      email: "priya.sharma@gmail.com",
      name: "Priya",
      arrivalTime: "08:00",
      goal: "jargon",
      industry: "Technology",
      onboarded: true,
    });
    expect(deps.onDone).toHaveBeenCalledOnce();
  });

  it("shows an error and stays put when saving fails", async () => {
    const { root, deps } = setup({ save: vi.fn().mockRejectedValue(new Error("Storage is full")) });
    await toGoalStep(root);
    goalRow(root, "Just curious").click();
    next(root).click();
    await tick();
    expect(q(root, ".err").textContent).toBe("Storage is full");
    expect(deps.onDone).not.toHaveBeenCalled();
    expect(next(root).disabled).toBe(false);
  });
});
