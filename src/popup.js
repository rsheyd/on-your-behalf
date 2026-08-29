import "./form-state.js";

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

settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
editProfileButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
fillButton.addEventListener("click", runFill);

let startedAt = 0;
let elapsedTimer = null;
let waitingTimer = null;
let currentStatus = "";

async function runFill() {
  showUnresolved([]);
  beginProgress();
  setStage("scan", "Scanning visible form fields…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Open a normal web page before filling.");

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/form-state.js", "src/content.js"] });
    let currentScan = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" });
    if (!currentScan?.ok) throw new Error(currentScan?.error || "Could not scan this page.");
    if (!currentScan.fields.length) throw new Error("No fillable, non-sensitive fields were found.");

    const { provider = "your AI provider" } = await chrome.storage.local.get("provider");
    const providerName = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" }[provider] || "your AI provider";
    let previousFields = [];
    let unresolved = [];
    let completedRounds = 0;
    let totalFilled = 0;
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
        blockedIds
      });
      const decision = formState.nextRoundDecision({
        completedRounds,
        maxRounds: MAX_FILL_ROUNDS,
        pendingCount: pending.length,
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
        payload: { page: currentScan.page, fields: pending }
      });
      if (!generated?.ok) throw new Error(generated?.error || "Could not generate suggestions.");

      if (!generated.suggestions.length) {
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

      setStage("fill", `Round ${completedRounds}: filling ${generated.suggestions.length} ${generated.suggestions.length === 1 ? "answer" : "answers"}…`);
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: "FILL_FORM",
        suggestions: generated.suggestions,
        expectedFields: pending
      });
      if (!result?.ok || !result.scan?.fields) throw new Error(result?.error || "Could not fill this page.");

      for (const fieldId of result.filledIds || []) filledIds.add(fieldId);
      for (const fieldId of result.skipped || []) filledIds.add(fieldId);
      for (const fieldId of result.failed || []) {
        blockedIds.add(fieldId);
        technicalFailures.add(fieldId);
      }
      totalFilled += result.filled || 0;

      const afterComparison = formState.compareFieldScans(currentScan.fields, result.scan.fields);
      const changedAfterFill = afterComparison.changedFields.map(field => field.fieldId);
      const staleIds = new Set([
        ...changedAfterFill,
        ...afterComparison.disappearedFields.map(field => field.fieldId)
      ]);
      unresolved = formState.reconcileUnresolved({
        previous: unresolved,
        updates: (generated.unresolved || []).filter(item => !staleIds.has(item.fieldId)),
        visibleFields: result.scan.fields,
        answeredIds: [...(result.filledIds || []), ...(result.skipped || [])],
        invalidatedIds: changedAfterFill
      });

      previousFields = currentScan.fields;
      currentScan = result.scan;
      lastProgress = (result.filled || 0)
        + (result.skipped || []).length
        + (generated.unresolved || []).length
        + afterComparison.newFields.length
        + afterComparison.changedFields.length
        + afterComparison.disappearedFields.length;
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
    const message = totalFilled
      ? `Filled ${totalFilled} fields across ${completedRounds} ${completedRounds === 1 ? "round" : "rounds"}. Review the green-outlined answers before submitting.${failureSuffix}${limitSuffix}`
      : `No fields could be filled from the current profile. Review the information needed below.${failureSuffix}${limitSuffix}`;
    finishProgress(message);
    showUnresolved(unresolved);
  } catch (error) {
    finishProgress(error.message || "Something went wrong.", true);
  }
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
  fillButton.textContent = "Scan and fill this page";
  status.textContent = `${message} (${elapsed.toFixed(1)}s)`;
  status.classList.toggle("error", isError);
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
