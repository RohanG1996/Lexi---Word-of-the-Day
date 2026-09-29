import { describe, it, expect, vi, afterEach } from "vitest";
import { renderSettings, type SettingsDeps } from "../../src/sidepanel/settings";
import type { Profile } from "../../src/lib/profile";

const PROFILE: Profile = {
  email: "priya.sharma@gmail.com",
  name: "Priya",
  arrivalTime: "08:00",
  goal: "communication",
  industry: "",
  onboarded: true,
};

function setup(overrides: Partial<SettingsDeps> = {}, profile: Profile = PROFILE) {
  const deps: SettingsDeps = {
    profile,
    save: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue("priya.sharma@gmail.com"),
    signOut: vi.fn().mockResolvedValue(undefined),
    confirmDelete: vi.fn().mockReturnValue(true),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    onBack: vi.fn(),
    onDeleted: vi.fn(),
    ...overrides,
  };
  const panel = renderSettings(deps);
  document.body.appendChild(panel);
  return { panel, deps };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const q = <T extends Element>(p: ParentNode, sel: string) => p.querySelector(sel) as T;
const option = (p: ParentNode, label: string) =>
  Array.from(p.querySelectorAll<HTMLButtonElement>(".lx-ddOption")).find((o) => o.textContent!.includes(label))!;

// Panels stay in the document between tests, and duplicate ids make jsdom's #id lookups miss the panel under test.
afterEach(() => {
  document.body.innerHTML = "";
});

describe("Settings view", () => {
  it("shows the account, name, arrival time and goal from the profile", () => {
    const { panel } = setup();
    expect(q(panel, ".pname").textContent).toBe("Priya");
    expect(q(panel, ".pmail").textContent).toBe("priya.sharma@gmail.com");
    expect(q<HTMLInputElement>(panel, "#settings-name").value).toBe("Priya");
    const triggers = panel.querySelectorAll(".lx-ddValue");
    expect(triggers[0].textContent).toBe("8:00 AM");
    expect(triggers[1].textContent).toBe("Improve communication");
  });

  it("goes back", () => {
    const { panel, deps } = setup();
    q<HTMLButtonElement>(panel, ".back").click();
    expect(deps.onBack).toHaveBeenCalledOnce();
  });

  it("lists the other goals under the selected one when the goal dropdown opens", () => {
    const { panel } = setup();
    const goalTrigger = panel.querySelectorAll<HTMLButtonElement>(".lx-ddTrigger")[1];
    goalTrigger.click();
    const labels = Array.from(panel.querySelectorAll(".lx-ddList")[1].querySelectorAll(".lx-ddOption")).map(
      (o) => o.textContent
    );
    expect(labels).toEqual(["Improve writing", "Learn industry jargon", "Everyday vocabulary", "Just curious"]);
  });

  it("saves edits to the name, time and goal", async () => {
    const { panel, deps } = setup();
    const name = q<HTMLInputElement>(panel, "#settings-name");
    name.value = "  Priyanka ";
    name.dispatchEvent(new Event("input"));

    panel.querySelectorAll<HTMLButtonElement>(".lx-ddTrigger")[0].click();
    option(panel, "9:00 AM").click();
    panel.querySelectorAll<HTMLButtonElement>(".lx-ddTrigger")[1].click();
    option(panel, "Improve writing").click();

    q<HTMLButtonElement>(panel, ".sSave").click();
    await tick();
    expect(deps.save).toHaveBeenCalledWith({ ...PROFILE, name: "Priyanka", arrivalTime: "09:00", goal: "writing" });
    expect(q(panel, ".sSave").textContent).toBe("Saved");
  });

  it("asks for an industry only for the industry jargon goal, and needs it to save", async () => {
    const { panel, deps } = setup();
    expect(panel.querySelector(".lx-industry")).toBeNull();
    panel.querySelectorAll<HTMLButtonElement>(".lx-ddTrigger")[1].click();
    option(panel, "Learn industry jargon").click();
    expect(panel.querySelector(".lx-industry")).not.toBeNull();

    q<HTMLButtonElement>(panel, ".sSave").click();
    await tick();
    expect(q(panel, ".sErr").textContent).toBe("Tell us which industry you work in.");
    expect(deps.save).not.toHaveBeenCalled();

    Array.from(panel.querySelectorAll<HTMLButtonElement>(".lx-chip")).find((c) => c.textContent === "Law")!.click();
    q<HTMLButtonElement>(panel, ".sSave").click();
    await tick();
    expect(deps.save).toHaveBeenCalledWith(expect.objectContaining({ goal: "jargon", industry: "Law" }));
  });

  it("won't save without a name", async () => {
    const { panel, deps } = setup();
    const name = q<HTMLInputElement>(panel, "#settings-name");
    name.value = " ";
    name.dispatchEvent(new Event("input"));
    q<HTMLButtonElement>(panel, ".sSave").click();
    await tick();
    expect(q(panel, ".sErr").textContent).toBe("Add a name for your library.");
    expect(deps.save).not.toHaveBeenCalled();
  });

  it("signs out, then offers to sign back in", async () => {
    const { panel, deps } = setup();
    q<HTMLButtonElement>(panel, ".linkBtn").click();
    await tick();
    expect(deps.signOut).toHaveBeenCalledOnce();
    expect(q(panel, ".pmail").textContent).toBe("Sign in to sync your library");
    q<HTMLButtonElement>(panel, ".linkBtn").click();
    await tick();
    expect(deps.signIn).toHaveBeenCalledOnce();
    expect(q(panel, ".pmail").textContent).toBe("priya.sharma@gmail.com");
  });

  it("deletes the account only after confirming", async () => {
    const { panel, deps } = setup({ confirmDelete: vi.fn().mockReturnValue(false) });
    q<HTMLButtonElement>(panel, ".sDelete").click();
    await tick();
    expect(deps.deleteAccount).not.toHaveBeenCalled();

    const confirmed = setup();
    q<HTMLButtonElement>(confirmed.panel, ".sDelete").click();
    await tick();
    expect(confirmed.deps.deleteAccount).toHaveBeenCalledOnce();
    expect(confirmed.deps.onDeleted).toHaveBeenCalledOnce();
  });
});
