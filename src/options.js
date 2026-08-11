import { defaultModel } from "./providers.js";

const form = document.querySelector("#settings-form");
const profile = document.querySelector("#profile");
const provider = document.querySelector("#provider");
const model = document.querySelector("#model");
const apiKey = document.querySelector("#api-key");
const status = document.querySelector("#status");
let apiKeys = {};
let previousProvider = "gemini";

initialize();
provider.addEventListener("change", () => {
  apiKeys[previousProvider] = apiKey.value.trim();
  previousProvider = provider.value;
  apiKey.value = apiKeys[provider.value] || "";
  model.value = defaultModel(provider.value);
});
form.addEventListener("submit", save);

async function initialize() {
  const saved = await chrome.storage.local.get(["profile", "provider", "model", "apiKeys"]);
  profile.value = saved.profile || "";
  provider.value = saved.provider || "gemini";
  previousProvider = provider.value;
  apiKeys = saved.apiKeys || {};
  model.value = saved.model || defaultModel(provider.value);
  apiKey.value = apiKeys[provider.value] || "";
}

async function save(event) {
  event.preventDefault();
  apiKeys[provider.value] = apiKey.value.trim();
  await chrome.storage.local.set({
    profile: profile.value.trim(),
    provider: provider.value,
    model: model.value.trim() || defaultModel(provider.value),
    apiKeys
  });
  status.textContent = "Saved.";
  setTimeout(() => { status.textContent = ""; }, 2500);
}
