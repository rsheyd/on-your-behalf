import "./form-state.js";
import "./field-label.js";
import { enabledSupportingDocuments } from "./supporting-documents.js";
import { actionsInScope, availableSections, fieldsInScope } from "./form-scope.js";

const formState = globalThis.OpenFormFillerState;
const MAX_FILL_ROUNDS = 6;
const MAX_FILL_DURATION_MS = 60000;
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
const LAST_FILL_RESULT_SESSION_KEY = "lastFillResult";
const DEFAULT_ANSWERING_POSTURE = "strongest_truthful_case";
const POSTURE_NOTES = {
  strongest_truthful_case: "Uses concrete relevant details and presents transferable experience positively.",
  exact_experience_only: "Answers only when your supplied information directly supports the exact experience requested.",
  leave_uncertain_open: "Fills clear facts and leaves adjacent or ambiguous answers for you."
};
let contextSaveTimer = null;

buildInfo.textContent = `OYB ${chrome.runtime.getManifest().version} · updated Sep 3, 2026 at 9:10 AM ET`;

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
const lastFillResultReady = restoreLastFillResult();

let startedAt = 0;
let elapsedTimer = null;
let waitingTimer = null;
let currentStatus = "";

async function runFill() {
  await Promise.all([sessionContextReady, answeringPostureReady, supportingFilesReady, answerOptionsReady, sectionScopeReady, lastFillResultReady]);
  await chrome.storage.session.remove(LAST_FILL_RESULT_SESSION_KEY);
  if (rememberContextInput.checked) await persistRememberedContext();
  showUnresolved([]);
  beginProgress();
  setStage("scan", "Scanning visible form fields…");
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
    if (!includeProfile && (!includeSupportingFiles || includeSupportingFilesInput.disabled) && !formContext) {
      throw new Error("Include your saved profile or supporting files, or add context for this form.");
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal web page before filling.");

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/form-state.js", "src/field-label.js", "src/content.js"] });
    let currentScan = scopeScan(await chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" }), selectedSectionId);
    if (!currentScan?.ok) throw new Error(currentScan?.error || "Could not scan this page.");
    if (!currentScan.fields.length) throw new Error("No fillable, non-sensitive fields were found.");

    const { provider = "your AI provider" } = await chrome.storage.local.get("provider");
    const providerName = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" }[provider] || "your AI provider";
    let previousFields = [];
    let unresolved = [];
    let completedRounds = 0;
    let totalFilled = 0;
    const basisCounts = { supported: 0, inferred: 0, chosen: 0 };
    let lastProgress = 1;
    let stopReason = "stable";
    const filledIds = new Set();
    const blockedIds = new Set();
    const technicalFailures = new Set();

    while (true) {
      if (performance.now() - startedAt >= MAX_FILL_DURATION_MS) {
        stopReason = "time_limit";
        break;
      }

      const comparison = formState.compareFieldScans(previousFields, currentScan.fields);
      const invalidatedIds = comparison.changedFields.map(field => field.fieldId);
      for (const fieldId of invalidatedIds) blockedIds.delete(fieldId);
      unresolved = formState.reconcileUnresolved({
        previous: unresolved,
        visibleFields: currentScan.fields,
        invalidatedIds
      });
      const resolvedIds = new Set(unresolved.map(item => item.fieldId));
      const pending = formState.unansweredFields(currentScan.fields, {
        filledIds,
        resolvedIds,
        blockedIds,
        includeExisting: replaceExisting
      });
      const availableActions = currentScan.actions || [];
      const decision = formState.nextRoundDecision({
        completedRounds,
        maxRounds: MAX_FILL_ROUNDS,
        pendingCount: pending.length + availableActions.length,
        progressCount: lastProgress
      });
      if (!decision.continue) {
        stopReason = decision.reason;
        break;
      }

      completedRounds += 1;
      setStage("generate", `Round ${completedRounds}: ${providerName} is preparing answers for ${pending.length} ${pending.length === 1 ? "field" : "fields"}…`);
      scheduleWaitingMessage(providerName, pending.length);
      const generated = await chrome.runtime.sendMessage({
        type: "GENERATE_SUGGESTIONS",
        payload: { page: currentScan.page, fields: pending, recordContext: currentScan.fields, actions: availableActions, formContext, includeProfile, includeSupportingFiles, answeringPosture, assumeAffirmative, allowAssumptions, includeConsequentialAssumptions }
      });
      if (!generated?.ok) throw new Error(generated?.error || "Could not generate suggestions.");

      const requestedAction = generated.actions?.[0];
      if (!generated.suggestions.length && !requestedAction) {
        unresolved = formState.reconcileUnresolved({
          previous: unresolved,
          updates: generated.unresolved || [],
          visibleFields: currentScan.fields
        });
        const resolvedNow = new Set(unresolved.map(item => item.fieldId));
        for (const field of pending) if (!resolvedNow.has(field.fieldId)) blockedIds.add(field.fieldId);
        stopReason = totalFilled ? "no_progress" : "no_answers";
        break;
      }

      let result;
      if (generated.suggestions.length) {
        setStage("fill", `Round ${completedRounds}: filling ${generated.suggestions.length} ${generated.suggestions.length === 1 ? "answer" : "answers"}…`);
        result = await chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", suggestions: generated.suggestions, expectedFields: pending, replaceExisting });
      } else {
        result = { ok: true, filled: 0, filledIds: [], failed: [], skipped: [], basisCounts: {}, mutated: false, scan: currentScan };
      }
      if (!result?.ok || !result.scan?.fields) throw new Error(result?.error || "Could not fill this page.");

      if (requestedAction && !result.mutated) {
        setStage("rescan", `Round ${completedRounds}: adding another ${currentScan.actions.find(action => action.actionId === requestedAction.actionId)?.groupLabel || "entry"}…`);
        const actionResult = await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_FORM_ACTION", action: requestedAction });
        if (actionResult?.ok && actionResult.activated && actionResult.scan?.fields) {
          result.scan = actionResult.scan;
          result.mutated = true;
        }
      }

      for (const fieldId of result.filledIds || []) filledIds.add(fieldId);
      for (const fieldId of result.skipped || []) filledIds.add(fieldId);
      for (const fieldId of result.failed || []) {
        blockedIds.add(fieldId);
        technicalFailures.add(fieldId);
      }
      totalFilled += result.filled || 0;
      for (const basis of Object.keys(basisCounts)) basisCounts[basis] += result.basisCounts?.[basis] || 0;

      const nextScan = scopeScan(result.scan, selectedSectionId);
      const afterComparison = formState.compareFieldScans(currentScan.fields, nextScan.fields);
      const changedAfterFill = afterComparison.changedFields.map(field => field.fieldId);
      const staleIds = new Set([
        ...changedAfterFill,
        ...afterComparison.disappearedFields.map(field => field.fieldId)
      ]);
      unresolved = formState.reconcileUnresolved({
        previous: unresolved,
        updates: (generated.unresolved || []).filter(item => !staleIds.has(item.fieldId)),
        visibleFields: nextScan.fields,
        answeredIds: [...(result.filledIds || []), ...(result.skipped || [])],
        invalidatedIds: changedAfterFill
      });

      previousFields = currentScan.fields;
      currentScan = nextScan;
      lastProgress = (result.filled || 0)
        + (result.skipped || []).length
        + (generated.unresolved || []).length
        + afterComparison.newFields.length
        + afterComparison.changedFields.length
        + afterComparison.disappearedFields.length;
      if (requestedAction && result.mutated) lastProgress += 1;
      if (result.mutated) setStage("rescan", `Round ${completedRounds}: the form changed, checking for additional questions…`);
    }

    const failureSuffix = technicalFailures.size ? ` ${technicalFailures.size} ${technicalFailures.size === 1 ? "field could" : "fields could"} not be matched.` : "";
    const limitSuffix = stopReason === "round_limit"
      ? " OYB stopped at its six-round safety limit."
      : stopReason === "time_limit"
        ? " OYB stopped at its one-minute safety limit."
        : stopReason === "no_progress"
          ? " OYB stopped because no further progress was possible."
          : "";
    const inferredSuffix = basisCounts.inferred ? ` ${basisCounts.inferred} inferred ${basisCounts.inferred === 1 ? "answer has" : "answers have"} an amber outline.` : "";
    const message = totalFilled
      ? `${replaceExisting ? "Updated" : "Filled"} ${totalFilled} fields across ${completedRounds} ${completedRounds === 1 ? "round" : "rounds"}. Review the outlined answers before submitting.${inferredSuffix}${failureSuffix}${limitSuffix}`
      : `No fields could be filled from the enabled profile or form context. Review the information needed below.${failureSuffix}${limitSuffix}`;
    const statusText = finishProgress(message);
    showUnresolved(unresolved);
    await persistLastFillResult(statusText, false, unresolved);
  } catch (error) {
    const statusText = finishProgress(error.message || "Something went wrong.", true);
    showUnresolved([]);
    await persistLastFillResult(statusText, true, []);
  }
}

function scopeScan(scan, sectionId) {
  return scan?.fields ? { ...scan, fields: fieldsInScope(scan.fields, sectionId), actions: actionsInScope(scan.actions, sectionId) } : scan;
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

function beginProgress() {
  clearTimeout(waitingTimer);
  waitingTimer = null;
  startedAt = performance.now();
  progress.hidden = false;
  fillButton.disabled = true;
  status.classList.remove("error");
  elapsedTimer = setInterval(renderStatus, 250);
}

function setStage(stage, message) {
  currentStatus = message;
  progress.dataset.stage = stage;
  fillButton.textContent = { scan: "Scanning…", generate: "Generating answers…", fill: "Filling page…", rescan: "Checking form…" }[stage] || "Working…";
  renderStatus();
}

function scheduleWaitingMessage(providerName, fieldCount) {
  clearTimeout(waitingTimer);
  waitingTimer = setTimeout(() => {
    if (progress.dataset.stage === "generate") {
      currentStatus = `${providerName} is still working through ${fieldCount} fields. Longer written answers can take a few seconds…`;
      renderStatus();
    }
  }, 4000);
}

function renderStatus() {
  const elapsed = startedAt ? Math.max(0, (performance.now() - startedAt) / 1000) : 0;
  status.textContent = `${currentStatus} ${elapsed.toFixed(1)}s`;
}

function finishProgress(message, isError = false) {
  clearInterval(elapsedTimer);
  clearTimeout(waitingTimer);
  elapsedTimer = null;
  waitingTimer = null;
  const elapsed = startedAt ? Math.max(0, (performance.now() - startedAt) / 1000) : 0;
  startedAt = 0;
  currentStatus = "";
  progress.dataset.stage = isError ? "" : "done";
  progress.hidden = isError;
  fillButton.disabled = false;
  renderFillButtonLabel();
  status.textContent = `${message} (${elapsed.toFixed(1)}s)`;
  status.classList.toggle("error", isError);
  return status.textContent;
}

async function persistLastFillResult(statusText, isError, unresolved) {
  await chrome.storage.session.set({ [LAST_FILL_RESULT_SESSION_KEY]: {
    statusText: String(statusText || "").slice(0, 2000),
    isError: Boolean(isError),
    unresolved: Array.isArray(unresolved) ? unresolved.slice(0, 150).map(item => ({ fieldId: String(item?.fieldId || ""), label: String(item?.label || "").slice(0, 500), reason: item?.reason })) : []
  } });
}

async function restoreLastFillResult() {
  const stored = await chrome.storage.session.get(LAST_FILL_RESULT_SESSION_KEY);
  const result = stored[LAST_FILL_RESULT_SESSION_KEY];
  if (!result || typeof result.statusText !== "string") return;
  status.textContent = result.statusText;
  status.classList.toggle("error", result.isError === true);
  showUnresolved(Array.isArray(result.unresolved) ? result.unresolved : []);
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
