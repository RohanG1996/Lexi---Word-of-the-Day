import { createApiKeyStore, isPlausibleApiKey } from "../lib/apiKey";
import { PROVIDERS, DEFAULT_PROVIDER, isProvider, type Provider } from "../lib/providers";

const store = createApiKeyStore(chrome.storage.local);
const providerSelect = document.getElementById("provider") as HTMLSelectElement;
const input = document.getElementById("apiKey") as HTMLInputElement;
const status = document.getElementById("status") as HTMLDivElement;

for (const p of PROVIDERS) {
  const option = document.createElement("option");
  option.value = p.id;
  option.textContent = p.label;
  providerSelect.appendChild(option);
}

function updatePlaceholder() {
  const provider = providerSelect.value as Provider;
  input.placeholder = PROVIDERS.find((p) => p.id === provider)?.keyPlaceholder ?? "";
}

providerSelect.value = DEFAULT_PROVIDER;
updatePlaceholder();
providerSelect.addEventListener("change", updatePlaceholder);

store.getSettings().then((settings) => {
  if (!settings) return;
  providerSelect.value = settings.provider;
  input.value = settings.key;
  updatePlaceholder();
});

document.getElementById("save")!.addEventListener("click", async () => {
  const providerValue = providerSelect.value;
  const key = input.value.trim();
  if (!isProvider(providerValue)) return;

  if (!isPlausibleApiKey(providerValue, key)) {
    const expected = PROVIDERS.find((p) => p.id === providerValue)?.keyPlaceholder;
    status.className = "err";
    status.textContent = `That doesn't look like a valid key for this provider (should look like "${expected}").`;
    return;
  }
  await store.setSettings({ provider: providerValue, key });
  status.className = "ok";
  status.textContent = "Saved.";
});
