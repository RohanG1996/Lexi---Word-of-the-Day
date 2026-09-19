import { createApiKeyStore, isPlausibleApiKey } from "../lib/apiKey";

const store = createApiKeyStore(chrome.storage.local);
const input = document.getElementById("apiKey") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

store.getApiKey().then((key) => {
  if (key) input.value = key;
});

document.getElementById("save")!.addEventListener("click", async () => {
  const key = input.value.trim();
  if (!isPlausibleApiKey(key)) {
    status.className = "err";
    status.textContent = "That doesn't look like a valid Anthropic API key (should start with sk-ant-).";
    return;
  }
  await store.setApiKey(key);
  status.className = "ok";
  status.textContent = "Saved.";
});
