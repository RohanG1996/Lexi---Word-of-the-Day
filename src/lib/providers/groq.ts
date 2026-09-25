const API_URL = "https://api.groq.com/openai/v1/chat/completions";
// The Llama models (llama-3.3-70b-versatile, llama-3.1-8b-instant) are
// Enterprise-tier only on Groq now ("Contact Sales" in their pricing table)
// and 404 on a standard developer API key. openai/gpt-oss-20b is on Groq's
// regular developer-plan production tier - re-check
// https://console.groq.com/docs/models if this ever starts 404ing too.
const MODEL = "openai/gpt-oss-20b";

export async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // gpt-oss is a reasoning model - its hidden reasoning tokens count
      // against max_tokens too, so 300 was leaving too little room for the
      // actual JSON reply and truncating it mid-string. reasoning_effort
      // "low" keeps more of the budget for the visible answer.
      max_tokens: 600,
      reasoning_effort: "low",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("Groq API error: unexpected response shape");
  }
  return text;
}
