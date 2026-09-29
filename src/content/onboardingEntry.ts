import { mountOnboarding } from "./onboarding";
import { createProfileStore } from "../lib/profile";
import { requestSignIn } from "../lib/messages";

// Glue for the onboarding pop-up (deliberately untested, like content/index.ts): injected by the background worker
// into the active tab on first run, and loaded by welcome.html when there is no ordinary web page to show it on.
async function main() {
  const profileStore = createProfileStore(chrome.storage.sync);
  const initial = await profileStore.getProfile();
  if (initial.onboarded) return;
  mountOnboarding({
    initial,
    // chrome.identity isn't available to content scripts, so ask the background worker for the account email.
    signIn: requestSignIn,
    save: (profile) => profileStore.setProfile(profile),
  });
}

main();
