// "gemini-2.5-flash" was picked as the current generally-available model id
// at the time this was written - a human should still confirm it's correct
// before shipping.
const MODEL = "gemini-2.5-flash";

export async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // gemini-2.5-flash spends output tokens on hidden "thinking" by
      // default, which can eat the whole response budget before it writes
      // the visible JSON and leave it truncated. Turning thinking off and
      // giving it enough tokens keeps the actual answer intact.
      generationConfig: { maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini API error: unexpected response shape");
  }
  return text;
}
