import type { StorageArea } from "./storage";
import { PROFILE_KEY } from "./profile";

// Everything Lexi keeps for the user. Used by Settings' "Delete account": the synced profile, library and today's
// word, plus this device's detail cache and "shown today" flag. (The API key is a device setting, not account data.)
const SYNC_KEYS = [PROFILE_KEY, "lexi.words", "lexi.todayWord"];
const LOCAL_KEYS = ["lexi.cache", "lexi.lastShownDate"];

export async function deleteAccountData(sync: StorageArea, local: StorageArea): Promise<void> {
  await sync.remove(SYNC_KEYS);
  await local.remove(LOCAL_KEYS);
}
