import { defaultModel, PROVIDERS, providerErrorMessage, testProviderConnection } from "./providers.js";
import { importDocumentFile } from "./document-import.js";
import { normalizeSupportingDocuments, validateSupportingDocuments } from "./supporting-documents.js";

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
const supportingFilesInput = document.querySelector("#supporting-files");
const supportingImportStatus = document.querySelector("#supporting-import-status");
const supportingDocumentsList = document.querySelector("#supporting-documents");
const noSupportingFiles = document.querySelector("#no-supporting-files");
const startTemplate = document.querySelector("#start-template");
let apiKeys = {};
let previousProvider = "gemini";
let models = {};
let supportingDocuments = [];

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
supportingFilesInput.addEventListener("change", importSupportingFiles);
startTemplate.addEventListener("click", insertStarterTemplate);
toggleKey.addEventListener("click", toggleKeyVisibility);
clearKey.addEventListener("click", clearProviderKey);
testConnectionButton.addEventListener("click", testConnection);
resetModel.addEventListener("click", () => { model.value = defaultModel(selectedProvider()); });

async function initialize() {
  const saved = await chrome.storage.local.get(["profile", "supportingDocuments", "provider", "model", "apiKeys"]);
  profile.value = saved.profile || "";
  supportingDocuments = normalizeSupportingDocuments(saved.supportingDocuments);
  renderSupportingDocuments();
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

async function importSupportingFiles() {
  const files = [...supportingFilesInput.files];
  if (!files.length) return;
  supportingFilesInput.disabled = true;
  supportingImportStatus.classList.remove("error");
  supportingImportStatus.textContent = `Reading ${files.length} ${files.length === 1 ? "file" : "files"}…`;
  try {
    const imported = await Promise.all(files.map(async file => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.name.toLowerCase().split(".").pop() || "",
      importedAt: new Date().toISOString(),
      enabled: true,
      text: await importDocumentFile(file)
    })));
    supportingDocuments = validateSupportingDocuments([...supportingDocuments, ...imported]);
    renderSupportingDocuments();
    supportingImportStatus.textContent = `Added ${files.length} supporting ${files.length === 1 ? "file" : "files"}. Review the list, then click Save settings.`;
  } catch (error) {
    supportingImportStatus.classList.add("error");
    supportingImportStatus.textContent = error instanceof Error ? error.message : "The supporting files could not be imported.";
  } finally {
    supportingFilesInput.disabled = false;
    supportingFilesInput.value = "";
  }
}

function renderSupportingDocuments() {
  supportingDocumentsList.replaceChildren();
  noSupportingFiles.hidden = supportingDocuments.length > 0;

  for (const supportingDocument of supportingDocuments) {
    const item = document.createElement("li");
    item.className = "supporting-document";
    const toggleLabel = document.createElement("label");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = supportingDocument.enabled;
    toggle.addEventListener("change", () => {
      supportingDocument.enabled = toggle.checked;
      supportingImportStatus.classList.remove("error");
      supportingImportStatus.textContent = "Supporting-file selection changed. Click Save settings to keep it.";
    });
    const details = document.createElement("span");
    const name = document.createElement("span");
    name.className = "supporting-document-name";
    name.textContent = supportingDocument.name;
    const meta = document.createElement("small");
    meta.className = "supporting-document-meta";
    meta.textContent = `${supportingDocument.type.toUpperCase() || "DOCUMENT"} · ${supportingDocument.text.length.toLocaleString()} characters`;
    details.append(name, meta);
    toggleLabel.append(toggle, details);
    const remove = document.createElement("button");
    remove.className = "supporting-remove";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${supportingDocument.name}`);
    remove.addEventListener("click", () => {
      supportingDocuments = supportingDocuments.filter(candidate => candidate.id !== supportingDocument.id);
      renderSupportingDocuments();
      supportingImportStatus.classList.remove("error");
      supportingImportStatus.textContent = "Supporting file removed. Click Save settings to make this permanent.";
    });
    item.append(toggleLabel, remove);
    supportingDocumentsList.append(item);
  }
}

async function save(event) {
  event.preventDefault();
  rememberCurrentProvider();
  const provider = selectedProvider();
  await chrome.storage.local.set({
    profile: profile.value.trim(),
    supportingDocuments: validateSupportingDocuments(supportingDocuments),
    provider,
    model: models[provider],
    apiKeys
  });
  renderProvider();
  status.textContent = "Saved.";
  setTimeout(() => { status.textContent = ""; }, 2500);
}
