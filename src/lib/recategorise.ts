import type { CompactWordRecord } from "./types";
import type { ModelClient } from "./modelClient";
import type { StorageArea } from "./storage";
import { OTHER_TOPIC } from "./prompts";

const DONE_KEY = "lexi.topicsRecategorised"; // local - per device

// Words saved while the topic prompt anchored every answer to "Everyday" (and words saved before topics existed)
// get their topic asked again, once per device. Only the topic changes.
export function needsRecategorising(word: CompactWordRecord): boolean {
  return !word.topic || word.topic === "Everyday";
}

export interface RecategoriseDeps {
  model: Pick<ModelClient, "explainWord">;
  wordStore: {
    getAllWords(): Promise<CompactWordRecord[]>;
    setTopics(topics: Record<string, string>): Promise<void>;
  };
  flagArea: StorageArea;
}

// Returns how many words got a new topic. The "done" flag is only set when every word was answered, so a failed
// call (no network, bad key) is retried the next time the panel opens.
export async function recategoriseWords({ model, wordStore, flagArea }: RecategoriseDeps): Promise<number> {
  if ((await flagArea.get(DONE_KEY))[DONE_KEY]) return 0;
  const pending = (await wordStore.getAllWords()).filter(needsRecategorising);
  const updates: Record<string, string> = {};
  let failed = false;
  for (const w of pending) {
    try {
      const { topic } = await model.explainWord(w.word);
      if (topic !== OTHER_TOPIC && topic !== w.topic) updates[w.word] = topic;
    } catch {
      failed = true;
    }
  }
  if (Object.keys(updates).length) await wordStore.setTopics(updates);
  if (!failed) await flagArea.set({ [DONE_KEY]: true });
  return Object.keys(updates).length;
}
