import { defaultModel } from "./providers.js";
import { importDocumentFile } from "./document-import.js";

const form = document.querySelector("#settings-form");
const profile = document.querySelector("#profile");
const provider = document.querySelector("#provider");
const model = document.querySelector("#model");
const apiKey = document.querySelector("#api-key");
const status = document.querySelector("#status");
const documentFile = document.querySelector("#document-file");
const importStatus = document.querySelector("#import-status");
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
documentFile.addEventListener("change", importDocument);

async function initialize() {
  const saved = await chrome.storage.local.get(["profile", "provider", "model", "apiKeys"]);
  profile.value = saved.profile || "";
  provider.value = saved.provider || "gemini";
  previousProvider = provider.value;
  apiKeys = saved.apiKeys || {};
  model.value = saved.model || defaultModel(provider.value);
  apiKey.value = apiKeys[provider.value] || "";
}

async function importDocument() {
  const file = documentFile.files[0];
  if (!file) return;
  if (profile.value.trim() && !confirm("Replace the current profile with this document? Your saved profile will remain unchanged until you click Save settings.")) {
    documentFile.value = "";
    return;
  }

  documentFile.disabled = true;
  importStatus.classList.remove("error");
  importStatus.textContent = `Reading ${file.name}…`;
  try {
    profile.value = await importDocumentFile(file);
    profile.focus();
    importStatus.textContent = "Document imported. Review the profile, then click Save settings.";
  } catch (error) {
    importStatus.classList.add("error");
    importStatus.textContent = error instanceof Error ? error.message : "The document could not be imported.";
  } finally {
    documentFile.disabled = false;
    documentFile.value = "";
  }
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
