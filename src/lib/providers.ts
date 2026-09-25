export type Provider = "anthropic" | "gemini" | "groq";

export interface ProviderInfo {
  id: Provider;
  label: string;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyPlaceholder: "sk-ant-..." },
  { id: "gemini", label: "Google (Gemini)", keyPlaceholder: "AIza..." },
  { id: "groq", label: "Groq", keyPlaceholder: "gsk_..." },
];

export const DEFAULT_PROVIDER: Provider = "anthropic";

export function isProvider(value: string): value is Provider {
  return PROVIDERS.some((p) => p.id === value);
}
