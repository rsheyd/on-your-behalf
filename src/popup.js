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

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content.js"] });
    const scan = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_FORM" });
    if (!scan?.ok) throw new Error(scan?.error || "Could not scan this page.");
    if (!scan.fields.length) throw new Error("No fillable, non-sensitive fields were found.");

    const { provider = "your AI provider" } = await chrome.storage.local.get("provider");
    const providerName = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" }[provider] || "your AI provider";
    setStage("generate", `Found ${scan.fields.length} fields. ${providerName} is preparing answers…`);
    scheduleWaitingMessage(providerName, scan.fields.length);
    const generated = await chrome.runtime.sendMessage({
      type: "GENERATE_SUGGESTIONS",
      payload: { page: scan.page, fields: scan.fields }
    });
    if (!generated?.ok) throw new Error(generated?.error || "Could not generate suggestions.");
    if (!generated.suggestions.length) {
      showUnresolved(generated.unresolved || []);
      finishProgress("No fields could be filled from the current profile. Review the information needed below.");
      return;
    }

    setStage("fill", `Answers are ready. Filling ${generated.suggestions.length} fields…`);
    const result = await chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", suggestions: generated.suggestions });
    if (!result?.ok) throw new Error(result?.error || "Could not fill this page.");
    const suffix = result.failed.length ? ` ${result.failed.length} could not be matched.` : "";
    finishProgress(`Filled ${result.filled} fields. Review the green-outlined answers before submitting.${suffix}`);
    showUnresolved(generated.unresolved || []);
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
  fillButton.textContent = { scan: "Scanning…", generate: "Generating answers…", fill: "Filling page…" }[stage] || "Working…";
  renderStatus();
}

function scheduleWaitingMessage(providerName, fieldCount) {
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
