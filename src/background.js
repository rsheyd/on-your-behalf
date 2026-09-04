import { buildPrompt, parseFormAnalysis } from "./prompt.js";
import { generateSuggestions } from "./providers.js";
import { enabledSupportingDocuments } from "./supporting-documents.js";
import { actionsInScope, fieldsInScope } from "./form-scope.js";
import { reconcileCheckpointForResume } from "./fill-operation.js";
import { createFillCheckpoint, runFillLoop } from "./fill-runner.js";

const FILL_OPERATION_KEY = "fillOperation";
const PROVIDER_TIMEOUT_MS = 25000;
const KEEPALIVE_INTERVAL_MS = 20000;
const activeRuns = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GENERATE_SUGGESTIONS") {
    handleGenerate(message.payload).then(analysis => sendResponse({ ok: true, ...analysis })).catch(error => sendResponse({ ok: false, error: error.message || "Suggestion generation failed." }));
    return true;
  }
  if (message?.type === "START_FILL") {
    startFill(message.payload).then(sendResponse);
    return true;
  }
  if (message?.type === "CONTINUE_FILL") {
    continueFill(message.tabId).then(sendResponse);
    return true;
  }
  if (message?.type === "GET_FILL_OPERATION") {
    getFillOperation(message.tabId).then(sendResponse);
    return true;
  }
  return false;
});

async function startFill(payload = {}) {
  const tabId = Number(payload.tabId);
  if (!tabId) return { ok: false, error: "No target tab was provided." };
  const existing = await readOperation();
  if (existing?.status === "running" && activeRuns.has(existing.operationId)) return { ok: false, error: existing.tabId === tabId ? "OYB is already filling this page." : "OYB is already filling another page." };
  const operation = { operationId: crypto.randomUUID(), tabId, pageUrl: String(payload.pageUrl || "").split("#")[0], status: "running", stage: "scan", message: "Scanning visible form fields…", isError: false, unresolved: [], totalFilled: 0, completedRounds: 0, elapsedMs: 0, startedAt: Date.now(), updatedAt: Date.now(), options: sanitizeOptions(payload.options), checkpoint: null };
  await writeOperation(operation);
  launchOperation(operation);
  return { ok: true, operation: publicOperation(operation) };
}

async function continueFill(tabId) {
  const operation = await readOperation();
  if (!operation || operation.tabId !== Number(tabId)) return { ok: false, error: "There is no paused fill for this page." };
  if (operation.status === "running" && activeRuns.has(operation.operationId)) return { ok: false, error: "OYB is already filling this page." };
  if (operation.status !== "paused") return { ok: false, error: "This fill cannot be continued." };
  Object.assign(operation, { status: "running", stage: "scan", message: "Checking the page before continuing…", isError: false, startedAt: Date.now(), updatedAt: Date.now() });
  await writeOperation(operation);
  launchOperation(operation);
  return { ok: true, operation: publicOperation(operation) };
}

async function getFillOperation(tabId) {
  const operation = await readOperation();
  if (!operation || operation.tabId !== Number(tabId)) return { ok: true, operation: null };
  if (operation.status === "running" && !activeRuns.has(operation.operationId)) {
    Object.assign(operation, { status: "paused", stage: "", message: "OYB was interrupted. Continue filling to resume from the saved checkpoint.", updatedAt: Date.now() });
    await writeOperation(operation);
  }
  return { ok: true, operation: publicOperation(operation) };
}

function launchOperation(operation) {
  const task = keepAliveWhile(runFillOperation(operation)).catch(error => failOperation(operation, error)).finally(() => activeRuns.delete(operation.operationId));
  activeRuns.set(operation.operationId, task);
}

async function keepAliveWhile(task) {
  const ping = () => chrome.runtime.getPlatformInfo().catch(() => {});
  await ping();
  const timer = setInterval(ping, KEEPALIVE_INTERVAL_MS);
  try {
    return await task;
  } finally {
    clearInterval(timer);
  }
}

async function runFillOperation(operation) {
  const { tabId, options } = operation;
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("The target page is no longer available.");
  if (operation.pageUrl && String(tab.url || "").split("#")[0] !== operation.pageUrl) throw new Error("The target tab navigated to a different page.");
  if (!options.includeProfile && !options.includeSupportingFiles && !options.formContext) throw new Error("Include your saved profile or supporting files, or add context for this form.");
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/form-state.js", "src/field-label.js", "src/content.js"] });

  let state = operation.checkpoint;
  if (!state) {
    const initialScan = scopeScan(await chrome.tabs.sendMessage(tabId, { type: "SCAN_FORM" }), options.selectedSectionId);
    if (!initialScan?.ok) throw new Error(initialScan?.error || "Could not scan this page.");
    if (!initialScan.fields.length) throw new Error("No fillable, non-sensitive fields were found.");
    state = createFillCheckpoint(initialScan, options.replaceExisting);
  } else {
    const freshScan = scopeScan(await chrome.tabs.sendMessage(tabId, { type: "SCAN_FORM" }), options.selectedSectionId);
    if (!freshScan?.ok) throw new Error(freshScan?.error || "Could not rescan this page.");
    state = reconcileCheckpointForResume(state, freshScan);
  }
  await saveCheckpoint(operation, state, "scan", operation.checkpoint ? "Resuming from the saved checkpoint…" : "Form scanned. Preparing answers…");

  const { provider = "your AI provider" } = await chrome.storage.local.get("provider");
  const providerName = { gemini: "Gemini", openai: "OpenAI", anthropic: "Anthropic" }[provider] || "your AI provider";
  const result = await runFillLoop({ state, options, providerName, generate: payload => handleGenerateWithTimeout({ ...payload, ...options }), fill: payload => chrome.tabs.sendMessage(tabId, { type: "FILL_FORM", ...payload }), activate: action => chrome.tabs.sendMessage(tabId, { type: "ACTIVATE_FORM_ACTION", action }), checkpoint: (nextState, stage, message) => saveCheckpoint(operation, nextState, stage, message), scopeScan: scan => scopeScan(scan, options.selectedSectionId) });
  state = result.state;
  const stopReason = result.stopReason;
  operation.elapsedMs += result.elapsedMs;
  Object.assign(operation, { checkpoint: state, totalFilled: state.totalFilled, completedRounds: state.aiCalls, unresolved: state.unresolved, stage: "", updatedAt: Date.now(), status: ["time_limit", "ai_limit", "dom_limit"].includes(stopReason) ? "paused" : "complete", message: resultMessage(state, options.replaceExisting, stopReason) });
  await writeOperation(operation);
}

async function saveCheckpoint(operation, state, stage, message) {
  Object.assign(operation, { status: "running", stage, message, checkpoint: state, totalFilled: state.totalFilled, completedRounds: state.aiCalls ?? state.completedRounds, unresolved: state.unresolved, updatedAt: Date.now() });
  await writeOperation(operation);
}

async function failOperation(operation, error) {
  console.error("Fill operation failed", error);
  const timedOut = error?.code === "provider_timeout";
  Object.assign(operation, { status: timedOut ? "paused" : "failed", stage: "", isError: !timedOut, message: timedOut ? "The AI provider took too long to respond. Continue the previous fill to retry from the saved checkpoint." : error?.message || "Something went wrong.", updatedAt: Date.now() });
  await writeOperation(operation);
}

function resultMessage(state, replaceExisting, stopReason) {
  const failures = state.technicalFailures.length;
  const failureSuffix = failures ? ` ${failures} ${failures === 1 ? "field could" : "fields could"} not be matched.` : "";
  const limitSuffix = stopReason === "ai_limit" ? " OYB paused at its adaptive AI-call limit." : stopReason === "dom_limit" ? " OYB paused at its form-change safety limit." : stopReason === "time_limit" ? " OYB paused at its five-minute safety limit." : stopReason === "no_progress" ? " OYB stopped because no further progress was possible." : "";
  const inferred = state.basisCounts.inferred;
  const inferredSuffix = inferred ? ` ${inferred} inferred ${inferred === 1 ? "answer has" : "answers have"} an amber outline.` : "";
  return state.totalFilled ? `${replaceExisting ? "Updated" : "Filled"} ${state.totalFilled} fields using ${state.aiCalls} AI ${state.aiCalls === 1 ? "call" : "calls"}. Review the outlined answers before submitting.${inferredSuffix}${failureSuffix}${limitSuffix}` : `No fields could be filled from the enabled profile or form context. Review the information needed below.${failureSuffix}${limitSuffix}`;
}

function sanitizeOptions(options = {}) {
  return { formContext: String(options.formContext || "").trim(), includeProfile: options.includeProfile !== false, includeSupportingFiles: options.includeSupportingFiles !== false, answeringPosture: options.answeringPosture, assumeAffirmative: options.assumeAffirmative === true, allowAssumptions: options.allowAssumptions === true, includeConsequentialAssumptions: options.includeConsequentialAssumptions === true, selectedSectionId: String(options.selectedSectionId || ""), replaceExisting: options.replaceExisting === true };
}

function scopeScan(scan, sectionId) {
  return scan?.fields ? { ...scan, fields: fieldsInScope(scan.fields, sectionId), actions: actionsInScope(scan.actions, sectionId) } : scan;
}

async function readOperation() {
  return (await chrome.storage.session.get(FILL_OPERATION_KEY))[FILL_OPERATION_KEY] || null;
}

async function writeOperation(operation) {
  await chrome.storage.session.set({ [FILL_OPERATION_KEY]: operation });
}

function publicOperation(operation) {
  if (!operation) return null;
  return { operationId: operation.operationId, tabId: operation.tabId, pageUrl: operation.pageUrl, status: operation.status, stage: operation.stage, message: operation.message, isError: operation.isError, unresolved: operation.unresolved || [], totalFilled: operation.totalFilled || 0, completedRounds: operation.completedRounds || 0, elapsedMs: (operation.elapsedMs || 0) + (operation.status === "running" ? Math.max(0, Date.now() - operation.startedAt) : 0), updatedAt: operation.updatedAt };
}

async function handleGenerateWithTimeout(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await handleGenerate({ ...payload, signal: controller.signal });
  } catch (error) {
    if (error?.name !== "AbortError") throw error;
    const timeoutError = new Error("The AI provider request timed out.");
    timeoutError.code = "provider_timeout";
    throw timeoutError;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleGenerate({ page, fields, recordContext = [], actions = [], formContext = "", includeProfile = true, includeSupportingFiles = true, answeringPosture, assumeAffirmative = false, allowAssumptions = false, includeConsequentialAssumptions = false, signal }) {
  const { profile = "", supportingDocuments = [], provider = "", apiKeys = {}, model = "" } = await chrome.storage.local.get(["profile", "supportingDocuments", "provider", "apiKeys", "model"]);
  const selectedProfile = includeProfile ? profile.trim() : "";
  const selectedSupportingDocuments = includeSupportingFiles ? enabledSupportingDocuments(supportingDocuments) : [];
  const selectedContext = String(formContext || "").trim();
  if (!selectedProfile && !selectedSupportingDocuments.length && !selectedContext) throw new Error("Include your saved profile or supporting files, or add context for this form.");
  const prompt = buildPrompt({ profile: selectedProfile, supportingDocuments: selectedSupportingDocuments, formContext: selectedContext, answeringPosture, assumeAffirmative, allowAssumptions, includeConsequentialAssumptions, page, fields, recordContext, actions });
  const text = await generateSuggestions({ provider, apiKey: apiKeys[provider] || "", model, prompt, signal });
  return parseFormAnalysis(text, fields, actions);
}
