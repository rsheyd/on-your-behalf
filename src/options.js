import { defaultModel, PROVIDERS, providerErrorMessage, testProviderConnection } from "./providers.js";
import { importDocumentFile } from "./document-import.js";

const form = document.querySelector("#settings-form");
const profile = document.querySelector("#profile");
const providerInputs = [...document.querySelectorAll('input[name="provider"]')];
const model = document.querySelector("#model");
const apiKey = document.querySelector("#api-key");
const providerName = document.querySelector("#provider-name");
const providerInstructions = document.querySelector("#provider-instructions");
const providerNote = document.querySelector("#provider-note");
const createKey = document.querySelector("#create-key");
const toggleKey = document.querySelector("#toggle-key");
const clearKey = document.querySelector("#clear-key");
const testConnectionButton = document.querySelector("#test-connection");
const connectionStatus = document.querySelector("#connection-status");
const resetModel = document.querySelector("#reset-model");
const status = document.querySelector("#status");
const documentFile = document.querySelector("#document-file");
const importStatus = document.querySelector("#import-status");
const startTemplate = document.querySelector("#start-template");
let apiKeys = {};
let previousProvider = "gemini";
let models = {};

const STARTER_PROFILE = `# My OYB Profile

## Contact and location

## Work and education

## Skills and useful links

## Reusable descriptions

## Information from other software

## Other useful information`;

initialize();
providerInputs.forEach(input => input.addEventListener("change", changeProvider));
form.addEventListener("submit", save);
documentFile.addEventListener("change", importDocument);
startTemplate.addEventListener("click", insertStarterTemplate);
toggleKey.addEventListener("click", toggleKeyVisibility);
clearKey.addEventListener("click", clearProviderKey);
testConnectionButton.addEventListener("click", testConnection);
resetModel.addEventListener("click", () => { model.value = defaultModel(selectedProvider()); });

async function initialize() {
  const saved = await chrome.storage.local.get(["profile", "provider", "model", "apiKeys"]);
  profile.value = saved.profile || "";
  previousProvider = PROVIDERS[saved.provider] ? saved.provider : "gemini";
  providerInputs.find(input => input.value === previousProvider).checked = true;
  apiKeys = saved.apiKeys || {};
  models[previousProvider] = saved.model || defaultModel(previousProvider);
  renderProvider();
}

function selectedProvider() {
  return providerInputs.find(input => input.checked)?.value || "gemini";
}

function rememberCurrentProvider() {
  const enteredKey = apiKey.value.trim();
  if (enteredKey) apiKeys[previousProvider] = enteredKey;
  models[previousProvider] = model.value.trim() || defaultModel(previousProvider);
}

function changeProvider() {
  rememberCurrentProvider();
  previousProvider = selectedProvider();
  renderProvider();
}

function renderProvider() {
  const provider = selectedProvider();
  const config = PROVIDERS[provider];
  providerName.textContent = `Connect ${config.name}`;
  providerInstructions.textContent = config.setup;
  providerNote.textContent = config.accountNote;
  createKey.href = config.keyUrl;
  createKey.textContent = `Create a ${config.name} API key ↗`;
  model.value = models[provider] || defaultModel(provider);
  apiKey.type = "password";
  apiKey.value = "";
  apiKey.placeholder = apiKeys[provider] ? `Saved key ending in ${apiKeys[provider].slice(-4)}` : "Paste API key";
  toggleKey.textContent = "Show";
  connectionStatus.textContent = apiKeys[provider] ? `${config.name} API key available. Test it to confirm the connection.` : "";
  connectionStatus.classList.remove("error", "success");
}

function toggleKeyVisibility() {
  apiKey.type = apiKey.type === "password" ? "text" : "password";
  toggleKey.textContent = apiKey.type === "password" ? "Show" : "Hide";
}

function clearProviderKey() {
  const provider = selectedProvider();
  if (!apiKey.value && !apiKeys[provider]) return;
  if (apiKeys[provider] && !confirm(`Clear the saved ${PROVIDERS[provider].name} API key? Click Save settings to make this permanent.`)) return;
  delete apiKeys[provider];
  apiKey.value = "";
  apiKey.placeholder = "Paste API key";
  connectionStatus.textContent = "API key cleared. Click Save settings to make this permanent.";
  connectionStatus.classList.remove("error", "success");
}

async function testConnection() {
  const provider = selectedProvider();
  const key = apiKey.value.trim() || apiKeys[provider] || "";
  testConnectionButton.disabled = true;
  connectionStatus.classList.remove("error", "success");
  connectionStatus.textContent = `Testing ${PROVIDERS[provider].name}…`;
  try {
    await testProviderConnection({ provider, apiKey: key, model: model.value });
    if (apiKey.value.trim()) apiKeys[provider] = apiKey.value.trim();
    connectionStatus.classList.add("success");
    connectionStatus.textContent = `${PROVIDERS[provider].name} connected. Click Save settings to keep this key.`;
  } catch (error) {
    connectionStatus.classList.add("error");
    connectionStatus.textContent = providerErrorMessage(error, provider);
  } finally {
    testConnectionButton.disabled = false;
  }
}

function insertStarterTemplate() {
  if (profile.value.trim() && !confirm("Replace the current profile with the starter template? Your saved profile will remain unchanged until you click Save settings.")) return;
  profile.value = STARTER_PROFILE;
  profile.focus();
  importStatus.classList.remove("error");
  importStatus.textContent = "Starter template added. Fill in or remove sections, then click Save settings.";
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
    importStatus.textContent = "Document imported. Review it before saving; this text may be sent to your selected AI provider when OYB fills forms.";
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
  rememberCurrentProvider();
  const provider = selectedProvider();
  await chrome.storage.local.set({
    profile: profile.value.trim(),
    provider,
    model: models[provider],
    apiKeys
  });
  renderProvider();
  status.textContent = "Saved.";
  setTimeout(() => { status.textContent = ""; }, 2500);
}
