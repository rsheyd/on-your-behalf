import "./form-state.js";
import { actionsForActiveExpansion, actionsForReplacementPhase, adaptiveAiCallAllowance, coherentFieldBatches, extendReplacementSnapshot, fillLimitReason, reconcileSuggestionQueue, snapshotAddedEntries, snapshotReplacement } from "./fill-operation.js";

const formState = globalThis.OpenFormFillerState;

export function createFillCheckpoint(scan, replaceExisting) {
  return { previousFields: [], currentScan: scan, unresolved: [], completedRounds: 0, aiCalls: 0, domPasses: 0, totalFilled: 0, basisCounts: { supported: 0, inferred: 0, chosen: 0 }, lastProgress: 1, filledIds: [], blockedIds: [], technicalFailures: [], settledReplacementIds: [], replacementSnapshot: replaceExisting ? snapshotReplacement(scan.fields) : { fieldIds: [], entries: [] }, expansionSnapshot: { fieldIds: [], entries: [] }, queuedSuggestions: [] };
}

export async function runFillLoop({ state, options, providerName = "your AI provider", generate, fill, activate, checkpoint = async () => {}, scopeScan = scan => scan, limits = {}, now = Date.now }) {
  const maxBatchFields = limits.maxBatchFields || 25;
  const maxDomPasses = limits.maxDomPasses || 20;
  const maxDurationMs = limits.maxDurationMs || 5 * 60 * 1000;
  const startedAt = now();
  state.aiCalls ??= state.completedRounds || 0;
  state.domPasses ??= 0;
  const startingAiCalls = state.aiCalls;
  const startingDomPasses = state.domPasses;
  let aiAllowance = null;
  let stopReason = "stable";
  while (true) {
    const currentScan = state.currentScan;
    const comparison = formState.compareFieldScans(state.previousFields, currentScan.fields);
    const invalidatedIds = comparison.changedFields.map(field => field.fieldId);
    for (const fieldId of invalidatedIds) removeValue(state.blockedIds, fieldId);
    state.unresolved = formState.reconcileUnresolved({ previous: state.unresolved, visibleFields: currentScan.fields, invalidatedIds });
    if (options.replaceExisting) state.replacementSnapshot = extendReplacementSnapshot(state.replacementSnapshot, currentScan.fields);
    state.expansionSnapshot = extendReplacementSnapshot(state.expansionSnapshot, currentScan.fields);
    const resolvedIds = new Set(state.unresolved.map(item => item.fieldId));
    const pending = formState.unansweredFields(currentScan.fields, { filledIds: new Set(state.filledIds), resolvedIds, blockedIds: new Set(state.blockedIds), includeExisting: options.replaceExisting });
    const replacementActions = options.replaceExisting ? actionsForReplacementPhase(currentScan.actions, state.replacementSnapshot, state.settledReplacementIds) : (currentScan.actions || []);
    const availableActions = actionsForActiveExpansion(replacementActions, state.expansionSnapshot, state.settledReplacementIds);
    state.queuedSuggestions = reconcileSuggestionQueue({ suggestions: state.queuedSuggestions, expectedFields: currentScan.fields, currentFields: currentScan.fields, completedIds: [...state.filledIds, ...state.blockedIds] });
    const batches = coherentFieldBatches(pending, maxBatchFields);
    if (aiAllowance === null) aiAllowance = adaptiveAiCallAllowance(pending, maxBatchFields);
    const limitReason = fillLimitReason({ pendingCount: pending.length, actionCount: availableActions.length, queuedCount: state.queuedSuggestions.length, elapsedMs: now() - startedAt, maxDurationMs, domPasses: state.domPasses - startingDomPasses, maxDomPasses, aiCalls: state.aiCalls - startingAiCalls, maxAiCalls: aiAllowance, progressCount: state.lastProgress, hasAppliedPass: state.domPasses > startingDomPasses });
    if (limitReason) { stopReason = limitReason; break; }

    let generated;
    let expectedFields;
    if (state.queuedSuggestions.length) {
      generated = { suggestions: state.queuedSuggestions, unresolved: [], actions: [] };
      expectedFields = currentScan.fields;
      await checkpoint(state, "fill", `Continuing ${state.queuedSuggestions.length} queued answers after the form changed…`);
    } else {
      expectedFields = batches[0] || [];
      const requestActions = batches.length <= 1 ? availableActions : [];
      state.aiCalls += 1;
      state.completedRounds = state.aiCalls;
      await checkpoint(state, "generate", `AI call ${state.aiCalls}: ${providerName} is preparing the next ${expectedFields.length} fields…`);
      generated = await generate({ fields: expectedFields, recordContext: currentScan.fields, actions: requestActions, page: currentScan.page });
    }

    const requestedAction = generated.actions?.[0];
    if (!generated.suggestions.length && !requestedAction) {
      if (!expectedFields.length) { stopReason = "stable"; break; }
      const unresolvedBefore = new Set(state.unresolved.map(item => item.fieldId));
      state.unresolved = formState.reconcileUnresolved({ previous: state.unresolved, updates: generated.unresolved || [], visibleFields: currentScan.fields });
      const resolvedProgress = state.unresolved.filter(item => !unresolvedBefore.has(item.fieldId)).length;
      if (resolvedProgress) { state.lastProgress = resolvedProgress; await checkpoint(state, "scan", `Reviewed ${state.filledIds.length + state.unresolved.length} fields…`); continue; }
      stopReason = state.totalFilled ? "no_progress" : "no_answers";
      break;
    }

    let result = generated.suggestions.length ? await fill({ suggestions: generated.suggestions, expectedFields, replaceExisting: options.replaceExisting }) : emptyResult(currentScan);
    if (!result?.ok || !result.scan?.fields) throw new Error(result?.error || "Could not fill this page.");
    state.queuedSuggestions = result.remainingSuggestions || [];
    if (requestedAction && !result.mutated) {
      await checkpoint(state, "rescan", `Adding another ${currentScan.actions.find(action => action.actionId === requestedAction.actionId)?.groupLabel || "entry"}…`);
      const actionResult = await activate(requestedAction);
      if (actionResult?.ok && actionResult.activated && actionResult.scan?.fields) {
        state.expansionSnapshot = snapshotAddedEntries(currentScan.fields, scopeScan(actionResult.scan).fields);
        result.scan = actionResult.scan;
        result.mutated = true;
        aiAllowance += 2;
      }
    }
    state.domPasses += 1;
    for (const fieldId of result.filledIds || []) addValue(state.filledIds, fieldId);
    for (const fieldId of [...(result.filledIds || []), ...(result.skipped || []), ...(result.failed || []), ...(generated.unresolved || []).map(item => item.fieldId)]) addValue(state.settledReplacementIds, fieldId);
    for (const fieldId of result.skipped || []) addValue(state.filledIds, fieldId);
    for (const fieldId of result.failed || []) { addValue(state.blockedIds, fieldId); addValue(state.technicalFailures, fieldId); }
    state.totalFilled += result.filled || 0;
    for (const basis of Object.keys(state.basisCounts)) state.basisCounts[basis] += result.basisCounts?.[basis] || 0;
    const nextScan = scopeScan(result.scan);
    const afterComparison = formState.compareFieldScans(currentScan.fields, nextScan.fields);
    const changedAfterFill = afterComparison.changedFields.map(field => field.fieldId);
    const staleIds = new Set([...changedAfterFill, ...afterComparison.disappearedFields.map(field => field.fieldId)]);
    for (const field of afterComparison.disappearedFields) addValue(state.settledReplacementIds, field.fieldId);
    if (options.replaceExisting) state.replacementSnapshot = extendReplacementSnapshot(state.replacementSnapshot, nextScan.fields);
    state.unresolved = formState.reconcileUnresolved({ previous: state.unresolved, updates: (generated.unresolved || []).filter(item => !staleIds.has(item.fieldId)), visibleFields: nextScan.fields, answeredIds: [...(result.filledIds || []), ...(result.skipped || [])], invalidatedIds: changedAfterFill });
    state.previousFields = currentScan.fields;
    state.currentScan = nextScan;
    state.lastProgress = (result.filled || 0) + (result.skipped || []).length + (generated.unresolved || []).length + afterComparison.newFields.length + afterComparison.changedFields.length + afterComparison.disappearedFields.length + (requestedAction && result.mutated ? 1 : 0);
    await checkpoint(state, result.mutated ? "rescan" : "fill", result.mutated ? "The form changed; checking for additional questions…" : `Applied ${state.totalFilled} answers…`);
  }
  return { state, stopReason, elapsedMs: now() - startedAt };
}

function emptyResult(scan) { return { ok: true, filled: 0, filledIds: [], failed: [], skipped: [], basisCounts: {}, mutated: false, scan }; }
function addValue(values, value) { if (!values.includes(value)) values.push(value); }
function removeValue(values, value) { const index = values.indexOf(value); if (index >= 0) values.splice(index, 1); }
