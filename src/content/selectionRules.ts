// Decides whether a text selection should offer "Add to my library". Lexi is for looking up single words
// (or a two-word term like "design system"), so longer selections - a sentence someone is copying,
// quoting or highlighting for their own reasons - must never trigger the popover.
export const MIN_LEN = 2;
export const MAX_LEN = 60;
export const MAX_WORDS = 2;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function isLookupCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) return false;
  return countWords(trimmed) <= MAX_WORDS;
}
