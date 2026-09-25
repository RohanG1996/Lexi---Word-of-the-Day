const API_URL = "https://api.anthropic.com/v1/messages";
// "claude-sonnet-5" was picked as the current generally-available model id
// at the time this was written - a human should still confirm it's correct
// before shipping.
const MODEL = "claude-sonnet-5";

export async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      // Explain prompts ask for 4 JSON fields (meaning, example,
      // pronunciation, partOfSpeech); 300 was cutting responses off
      // mid-string and breaking JSON.parse.
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }
  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic API error: unexpected response shape");
  }
  return text;
}
