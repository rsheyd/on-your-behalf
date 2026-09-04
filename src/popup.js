import { enabledSupportingDocuments } from "./supporting-documents.js";
import { availableSections } from "./form-scope.js";

const fillButton = document.querySelector("#fill");
const settingsButton = document.querySelector("#settings");
const status = document.querySelector("#status");
const progress = document.querySelector("#progress");
const unresolvedPanel = document.querySelector("#unresolved");
const unresolvedTitle = document.querySelector("#unresolved-title");
const unresolvedList = document.querySelector("#unresolved-list");
const editProfileButton = document.querySelector("#edit-profile");
const toggleContextButton = document.querySelector("#toggle-context");
const formContextPanel = document.querySelector("#form-context-panel");
const formContextInput = document.querySelector("#form-context");
const includeProfileInput = document.querySelector("#include-profile");
const includeSupportingFilesInput = document.querySelector("#include-supporting-files");
const supportingFilesCount = document.querySelector("#supporting-files-count");
const scopeRow = document.querySelector("#scope-row");
const sectionScopeInput = document.querySelector("#section-scope");
const replaceExistingInput = document.querySelector("#replace-existing");
const answeringPostureInput = document.querySelector("#answering-posture");
const postureNote = document.querySelector("#posture-note");
const assumeAffirmativeInput = document.querySelector("#assume-affirmative");
const allowAssumptionsInput = document.querySelector("#allow-assumptions");
const consequentialAssumptionsRow = document.querySelector("#consequential-assumptions-row");
const includeConsequentialAssumptionsInput = document.querySelector("#include-consequential-assumptions");
const buildInfo = document.querySelector("#build-info");
const rememberContextInput = document.querySelector("#remember-context");
const clearContextButton = document.querySelector("#clear-context");
const FORM_CONTEXT_SESSION_KEY = "formContextDraft";
const DEFAULT_ANSWERING_POSTURE = "strongest_truthful_case";
const POSTURE_NOTES = {
  strongest_truthful_case: "Uses concrete relevant details and presents transferable experience positively.",
  exact_experience_only: "Answers only when your supplied information directly supports the exact experience requested.",
  leave_uncertain_open: "Fills clear facts and leaves adjacent or ambiguous answers for you."
};
let contextSaveTimer = null;
let targetTabId = null;
let operationTimer = null;
let currentOperation = null;

buildInfo.textContent = `OYB ${chrome.runtime.getManifest().version} · updated Sep 4, 2026 at 9:46 AM ET`;

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
editProfileButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
fillButton.addEventListener("click", runFill);
formContextInput.addEventListener("input", scheduleContextSave);
rememberContextInput.addEventListener("change", async () => {
  clearTimeout(contextSaveTimer);
  if (rememberContextInput.checked) await persistRememberedContext();
  else await chrome.storage.session.remove(FORM_CONTEXT_SESSION_KEY);
});
clearContextButton.addEventListener("click", async () => {
  clearTimeout(contextSaveTimer);
  formContextInput.value = "";
  await chrome.storage.session.remove(FORM_CONTEXT_SESSION_KEY);
  formContextInput.focus();
});
answeringPostureInput.addEventListener("change", async () => {
  const answeringPosture = POSTURE_NOTES[answeringPostureInput.value] ? answeringPostureInput.value : DEFAULT_ANSWERING_POSTURE;
  answeringPostureInput.value = answeringPosture;
  renderPostureNote();
  await chrome.storage.local.set({ answeringPosture });
});
includeSupportingFilesInput.addEventListener("change", async () => {
  await chrome.storage.local.set({ includeSupportingFiles: includeSupportingFilesInput.checked });
});
assumeAffirmativeInput.addEventListener("change", () => chrome.storage.local.set({ assumeAffirmative: assumeAffirmativeInput.checked }));
allowAssumptionsInput.addEventListener("change", async () => {
  consequentialAssumptionsRow.hidden = !allowAssumptionsInput.checked;
  await chrome.storage.local.set({ allowAssumptions: allowAssumptionsInput.checked });
});
includeConsequentialAssumptionsInput.addEventListener("change", () => chrome.storage.local.set({ includeConsequentialAssumptions: includeConsequentialAssumptionsInput.checked }));
sectionScopeInput.addEventListener("change", renderFillButtonLabel);
replaceExistingInput.addEventListener("change", renderFillButtonLabel);
toggleContextButton.addEventListener("click", () => {
  const expanded = toggleContextButton.getAttribute("aria-expanded") === "true";
  toggleContextButton.setAttribute("aria-expanded", String(!expanded));
  toggleContextButton.textContent = expanded ? "Add context for this form" : "Hide form context";
  formContextPanel.hidden = expanded;
  if (!expanded) formContextInput.focus();
});

const sessionContextReady = restoreSessionContext();
const answeringPostureReady = restoreAnsweringPosture();
const supportingFilesReady = restoreSupportingFiles();
const answerOptionsReady = restoreAnswerOptions();
const sectionScopeReady = restoreSectionScopes();
const fillOperationReady = restoreFillOperation();

async function runFill() {
  await Promise.all([sessionContextReady, answeringPostureReady, supportingFilesReady, answerOptionsReady, sectionScopeReady, fillOperationReady]);
  if (rememberContextInput.checked) await persistRememberedContext();
  showUnresolved([]);
  try {
    const formContext = formContextInput.value.trim();
    const includeProfile = includeProfileInput.checked;
    const includeSupportingFiles = includeSupportingFilesInput.checked;
    const answeringPosture = answeringPostureInput.value;
    const assumeAffirmative = assumeAffirmativeInput.checked;
    const allowAssumptions = allowAssumptionsInput.checked;
    const includeConsequentialAssumptions = allowAssumptions && includeConsequentialAssumptionsInput.checked;
    const selectedSectionId = sectionScopeInput.value;
    const replaceExisting = replaceExistingInput.checked;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal web page before filling.");
    targetTabId = tab.id;
    const current = await chrome.runtime.sendMessage({ type: "GET_FILL_OPERATION", tabId: tab.id });
    let response;
    if (current?.operation?.status === "paused") {
      response = await chrome.runtime.sendMessage({ type: "CONTINUE_FILL", tabId: tab.id });
    } else {
      if (!includeProfile && (!includeSupportingFiles || includeSupportingFilesInput.disabled) && !formContext) throw new Error("Include your saved profile or supporting files, or add context for this form.");
      response = await chrome.runtime.sendMessage({ type: "START_FILL", payload: { tabId: tab.id, pageUrl: tab.url, options: { formContext, includeProfile, includeSupportingFiles, answeringPosture, assumeAffirmative, allowAssumptions, includeConsequentialAssumptions, selectedSectionId, replaceExisting } } });
    }
    if (!response?.ok) throw new Error(response?.error || "Could not start filling this page.");
    renderOperation(response.operation);
    startOperationPolling();
  } catch (error) {
    progress.hidden = true;
    fillButton.disabled = false;
    status.textContent = error.message || "Something went wrong.";
    status.classList.add("error");
    showUnresolved([]);
  }
}

async function restoreSectionScopes() {
  scopeRow.hidden = true;
  sectionScopeInput.replaceChildren(new Option("Entire page", ""));
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) return;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/form-state.js", "src/field-label.js", "src/content.js"] });
    const scan = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" });
    if (!scan?.ok) return;
    const sections = availableSections(scan.fields);
    for (const section of sections) sectionScopeInput.add(new Option(section.label, section.id));
    scopeRow.hidden = sections.length === 0;
  } catch {
    scopeRow.hidden = true;
  } finally {
    renderFillButtonLabel();
  }
}

function renderFillButtonLabel() {
  if (currentOperation?.status === "running") {
    fillButton.textContent = { scan: "Scanning…", generate: "Generating answers…", fill: "Filling page…", rescan: "Checking form…" }[currentOperation.stage] || "Working…";
    return;
  }
  if (currentOperation?.status === "paused") {
    fillButton.textContent = "Continue previous fill";
    return;
  }
  if (replaceExistingInput.checked) {
    fillButton.textContent = sectionScopeInput.value ? "Review and replace this section" : "Review and replace this page";
  } else {
    fillButton.textContent = sectionScopeInput.value ? "Scan and fill this section" : "Scan and fill this page";
  }
}

async function restoreSupportingFiles() {
  const stored = await chrome.storage.local.get(["supportingDocuments", "includeSupportingFiles"]);
  const count = enabledSupportingDocuments(stored.supportingDocuments).length;
  includeSupportingFilesInput.disabled = count === 0;
  includeSupportingFilesInput.checked = count > 0 && stored.includeSupportingFiles !== false;
  supportingFilesCount.textContent = count ? `(${count} enabled)` : "(none added)";
}

async function restoreAnsweringPosture() {
  const stored = await chrome.storage.local.get("answeringPosture");
  answeringPostureInput.value = POSTURE_NOTES[stored.answeringPosture] ? stored.answeringPosture : DEFAULT_ANSWERING_POSTURE;
  renderPostureNote();
}

async function restoreAnswerOptions() {
  const saved = await chrome.storage.local.get(["assumeAffirmative", "allowAssumptions", "includeConsequentialAssumptions"]);
  assumeAffirmativeInput.checked = saved.assumeAffirmative === true;
  allowAssumptionsInput.checked = saved.allowAssumptions === true;
  includeConsequentialAssumptionsInput.checked = saved.includeConsequentialAssumptions === true;
  consequentialAssumptionsRow.hidden = !allowAssumptionsInput.checked;
}

function renderPostureNote() {
  postureNote.textContent = POSTURE_NOTES[answeringPostureInput.value] || POSTURE_NOTES[DEFAULT_ANSWERING_POSTURE];
}

async function restoreSessionContext() {
  const stored = await chrome.storage.session.get(FORM_CONTEXT_SESSION_KEY);
  const remembered = String(stored[FORM_CONTEXT_SESSION_KEY] || "");
  if (!remembered) return;
  formContextInput.value = remembered;
  rememberContextInput.checked = true;
  formContextPanel.hidden = false;
  toggleContextButton.setAttribute("aria-expanded", "true");
  toggleContextButton.textContent = "Hide form context";
}

function scheduleContextSave() {
  if (!rememberContextInput.checked) return;
  clearTimeout(contextSaveTimer);
  contextSaveTimer = setTimeout(() => persistRememberedContext(), 200);
}

async function persistRememberedContext() {
  const value = formContextInput.value.trim();
  if (value) await chrome.storage.session.set({ [FORM_CONTEXT_SESSION_KEY]: value });
  else await chrome.storage.session.remove(FORM_CONTEXT_SESSION_KEY);
}

async function restoreFillOperation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    targetTabId = tab.id;
    const response = await chrome.runtime.sendMessage({ type: "GET_FILL_OPERATION", tabId: tab.id });
    if (!response?.operation) return;
    renderOperation(response.operation);
    if (response.operation.status === "running") startOperationPolling();
  } catch {
    return;
  }
}

function renderOperation(operation) {
  currentOperation = operation;
  const running = operation?.status === "running";
  const elapsed = Math.max(0, Number(operation?.elapsedMs) || 0) / 1000;
  progress.hidden = !operation || operation.status === "failed";
  progress.dataset.stage = running ? operation.stage : operation?.status === "complete" ? "done" : "";
  fillButton.disabled = running;
  status.classList.toggle("error", operation?.isError === true || operation?.status === "failed");
  status.textContent = operation ? `${operation.message} (${elapsed.toFixed(1)}s)` : "Nothing is submitted automatically.";
  showUnresolved(Array.isArray(operation?.unresolved) ? operation.unresolved : []);
  renderFillButtonLabel();
}

function startOperationPolling() {
  clearInterval(operationTimer);
  operationTimer = setInterval(refreshOperation, 500);
}

async function refreshOperation() {
  if (!targetTabId) return;
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_FILL_OPERATION", tabId: targetTabId });
    if (!response?.operation) return;
    renderOperation(response.operation);
    if (response.operation.status !== "running") {
      clearInterval(operationTimer);
      operationTimer = null;
    }
  } catch {
    clearInterval(operationTimer);
    operationTimer = null;
  }
}

function showUnresolved(items) {
  const relevant = items.filter(item => item.reason !== "not_applicable");
  unresolvedList.replaceChildren();
  unresolvedPanel.hidden = relevant.length === 0;
  if (!relevant.length) return;

  const missingCount = relevant.filter(item => item.reason === "missing_profile_info").length;
  unresolvedTitle.textContent = missingCount
    ? `Your profile is missing ${missingCount} ${missingCount === 1 ? "answer" : "answers"}`
    : "Questions that need your decision";

  for (const item of relevant) {
    const listItem = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = item.label;
    listItem.append(label);
    if (item.reason === "requires_user_judgment") {
      const reason = document.createElement("span");
      reason.className = "reason";
      reason.textContent = " — needs your decision";
      listItem.append(reason);
    }
    unresolvedList.append(listItem);
  }
}
