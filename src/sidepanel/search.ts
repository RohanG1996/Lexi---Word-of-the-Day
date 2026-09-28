import type { CompactWordRecord } from "../lib/types";
import { OTHER_TOPIC } from "../lib/prompts";

export const ALL_TOPICS = "All";

export function filterWords(words: CompactWordRecord[], query: string): CompactWordRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return words;
  return words.filter(
    (w) =>
      w.word.toLowerCase().includes(q) ||
      w.shortMeaning.toLowerCase().includes(q) ||
      topicOf(w).toLowerCase().includes(q)
  );
}

// Words saved before topics existed have none; they are grouped as "Other".
export function topicOf(word: CompactWordRecord): string {
  return word.topic || OTHER_TOPIC;
}

export interface TopicChip {
  topic: string;
  count: number;
}

// One chip per topic actually present, biggest first (ties alphabetical), with "Other" always last.
export function topicChips(words: CompactWordRecord[]): TopicChip[] {
  const counts = new Map<string, number>();
  for (const w of words) counts.set(topicOf(w), (counts.get(topicOf(w)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => {
      if (a.topic === OTHER_TOPIC) return 1;
      if (b.topic === OTHER_TOPIC) return -1;
      return b.count - a.count || a.topic.localeCompare(b.topic);
    });
}

// The selected chip narrows to that topic; the query then filters within it.
export function searchWords(words: CompactWordRecord[], query: string, topic: string): CompactWordRecord[] {
  const inTopic = topic === ALL_TOPICS ? words : words.filter((w) => topicOf(w) === topic);
  return filterWords(inTopic, query);
}
