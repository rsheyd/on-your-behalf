import "./form-state.js";
import { actionsForActiveExpansion, actionsForReplacementPhase, adaptiveAiCallAllowance, coherentFieldBatches, extendReplacementSnapshot, fillLimitReason, reconcileSuggestionQueue, snapshotAddedEntries, snapshotReplacement } from "./fill-operation.js";

const formState = globalThis.OpenFormFillerState;

export function createFillCheckpoint(scan, replaceExisting) {
  return { previousFields: [], currentScan: scan, unresolved: [], completedRounds: 0, aiCalls: 0, domPasses: 0, totalFilled: 0, basisCounts: { supported: 0, inferred: 0, chosen: 0 }, lastProgress: 1, filledIds: [], blockedIds: [], technicalFailures: [], settledReplacementIds: [], replacementSnapshot: replaceExisting ? snapshotReplacement(scan.fields) : { fieldIds: [], entries: [] }, expansionSnapshot: { fieldIds: [], entries: [] }, queuedSuggestions: [], collectionPlans: {}, declinedActionKey: "" };
}

export async function runFillLoop({ state, options, providerName = "your AI provider", generate, fill, activate, checkpoint = async () => {}, onEvent = async () => {}, scopeScan = scan => scan, limits = {}, now = Date.now, signal }) {
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
    throwIfCanceled(signal);
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
    let availableActions = actionsForActiveExpansion(replacementActions, state.expansionSnapshot, state.settledReplacementIds);
    state.collectionPlans ??= {};
    if (options.replaceExisting && Object.keys(state.collectionPlans).length) {
      const plannedAction = plannedAddAction(currentScan.fields, availableActions, state.collectionPlans);
      availableActions = plannedAction ? [plannedAction] : [];
    }
    state.queuedSuggestions = reconcileSuggestionQueue({ suggestions: state.queuedSuggestions, expectedFields: currentScan.fields, currentFields: currentScan.fields, completedIds: [...state.filledIds, ...state.blockedIds] });
    const batchOptions = { wholeRepeatedCollections: options.replaceExisting === true };
    const batches = coherentFieldBatches(pending, maxBatchFields, batchOptions);
    if (aiAllowance === null) aiAllowance = adaptiveAiCallAllowance(pending, maxBatchFields, 2, batchOptions);
    const limitReason = fillLimitReason({ pendingCount: pending.length, actionCount: availableActions.length, queuedCount: state.queuedSuggestions.length, elapsedMs: now() - startedAt, maxDurationMs, domPasses: state.domPasses - startingDomPasses, maxDomPasses, aiCalls: state.aiCalls - startingAiCalls, maxAiCalls: aiAllowance, progressCount: state.lastProgress, hasAppliedPass: state.domPasses > startingDomPasses });
    if (limitReason) {
      stopReason = limitReason;
      await onEvent("stop_evaluation", stopDiagnostics({ decision: stopReason, pending, availableActions, state, startingAiCalls, aiAllowance }));
      break;
    }

    let generated;
    let expectedFields;
    if (state.queuedSuggestions.length) {
      generated = { suggestions: state.queuedSuggestions, unresolved: [], actions: [] };
      expectedFields = currentScan.fields;
      await onEvent("batch_selected", batchDiagnostics({ pending, expectedFields, batches, source: "queue" }));
      await checkpoint(state, "fill", `Continuing ${state.queuedSuggestions.length} queued answers after the form changed…`);
    } else {
      expectedFields = batches[0] || [];
      const collectionId = replacementCollectionId(expectedFields, options.replaceExisting);
      const existingPlan = collectionId ? state.collectionPlans[collectionId] : null;
      await onEvent("batch_selected", batchDiagnostics({ pending, expectedFields, batches, source: existingPlan ? "saved_plan" : "provider", collectionId }));
      if (collectionId && !existingPlan) {
        state.aiCalls += 1;
        state.completedRounds = state.aiCalls;
        await checkpoint(state, "generate", `${providerName} is organizing the repeated records…`);
        await onEvent("ai_request", { aiCall: state.aiCalls, fields: expectedFields, actions: [], planCollection: collectionId });
        const planned = await generate({ fields: expectedFields, recordContext: [], actions: [], page: currentScan.page, replaceExisting: true, planCollection: collectionId, signal });
        await onEvent("ai_response", { aiCall: state.aiCalls, plan: planned.plan || [], planInvalid: planned.planInvalid || [], suggestions: [], unresolved: [], invalid: [], actions: [] });
        if (!planned.plan?.length) {
          stopReason = "no_answers";
          await onEvent("stop_evaluation", stopDiagnostics({ decision: stopReason, pending, availableActions, state, startingAiCalls, aiAllowance }));
          break;
        }
        state.collectionPlans[collectionId] = planned.plan;
        aiAllowance += 1;
        state.lastProgress = 1;
        await checkpoint(state, "generate", `Organized ${planned.plan.length} repeated records…`);
        continue;
      }
      if (existingPlan) {
        const suggestions = suggestionsFromPlan(expectedFields, existingPlan);
        const suggestedIds = new Set(suggestions.map(item => item.fieldId));
        const missingFromPlan = expectedFields.filter(field => !suggestedIds.has(field.fieldId));
        generated = { suggestions, unresolved: missingFromPlan.map(field => ({ fieldId: field.fieldId, reason: "missing_profile_info" })), actions: [] };
        await onEvent("plan_applied", {
          collectionId,
          requestedFields: diagnosticFields(expectedFields),
          suggestedFieldIds: [...suggestedIds],
          missingFromPlan: diagnosticFields(missingFromPlan)
        });
      }
      const plannedAction = plannedAddAction(currentScan.fields, availableActions, state.collectionPlans);
      if (!expectedFields.length && plannedAction) generated = { suggestions: [], unresolved: [], actions: [plannedAction] };
      if (!generated) {
        const requestActions = batches.length <= 1 ? availableActions : [];
        state.aiCalls += 1;
        state.completedRounds = state.aiCalls;
        await checkpoint(state, "generate", `AI call ${state.aiCalls}: ${providerName} is preparing the next ${expectedFields.length} fields…`);
        await onEvent("ai_request", { aiCall: state.aiCalls, fields: expectedFields, actions: requestActions });
        generated = await generate({ fields: expectedFields, recordContext: currentScan.fields, actions: requestActions, page: currentScan.page, replaceExisting: options.replaceExisting === true, signal });
        await onEvent("ai_response", { aiCall: state.aiCalls, suggestions: generated.suggestions || [], unresolved: generated.unresolved || [], invalid: generated.invalid || [], actions: generated.actions || [] });
      }
    }

    const requestedAction = generated.actions?.[0];
    if (!generated.suggestions.length && !requestedAction) {
      if (!expectedFields.length) {
        const decisionKey = actionDecisionKey(currentScan, availableActions);
        if (availableActions.length && state.declinedActionKey !== decisionKey) {
          state.declinedActionKey = decisionKey;
          aiAllowance += 1;
          state.lastProgress = 1;
          await checkpoint(state, "generate", "Confirming that no additional repeated entry is needed…");
          continue;
        }
        stopReason = "stable";
        await onEvent("stop_evaluation", stopDiagnostics({ decision: stopReason, pending, availableActions, state, startingAiCalls, aiAllowance }));
        break;
      }
      if (generated.invalid?.length) { state.lastProgress = 1; await checkpoint(state, "generate", `Retrying ${generated.invalid.length} invalid ${generated.invalid.length === 1 ? "answer" : "answers"}…`); continue; }
      const unresolvedBefore = new Set(state.unresolved.map(item => item.fieldId));
      state.unresolved = formState.reconcileUnresolved({ previous: state.unresolved, updates: generated.unresolved || [], visibleFields: currentScan.fields });
      const resolvedProgress = state.unresolved.filter(item => !unresolvedBefore.has(item.fieldId)).length;
      if (resolvedProgress) { state.lastProgress = resolvedProgress; await checkpoint(state, "scan", `Reviewed ${state.filledIds.length + state.unresolved.length} fields…`); continue; }
      stopReason = state.totalFilled ? "no_progress" : "no_answers";
      await onEvent("stop_evaluation", stopDiagnostics({ decision: stopReason, pending, availableActions, state, startingAiCalls, aiAllowance }));
      break;
    }

    throwIfCanceled(signal);
    let result = generated.suggestions.length ? await fill({ suggestions: generated.suggestions, expectedFields, replaceExisting: options.replaceExisting }) : emptyResult(currentScan);
    if (!result?.ok || !result.scan?.fields) throw new Error(result?.error || "Could not fill this page.");
    await onEvent("fill_result", { filledIds: result.filledIds || [], failed: result.failed || [], skipped: result.skipped || [], queued: (result.remainingSuggestions || []).map(item => item.fieldId), mutated: Boolean(result.mutated) });
    state.queuedSuggestions = result.remainingSuggestions || [];
    if (requestedAction && !result.mutated) {
      await checkpoint(state, "rescan", `Adding another ${currentScan.actions.find(action => action.actionId === requestedAction.actionId)?.groupLabel || "entry"}…`);
      const actionResult = await activate(requestedAction);
      await onEvent("action_result", { action: requestedAction, activated: Boolean(actionResult?.activated) });
      if (actionResult?.ok && actionResult.activated && actionResult.scan?.fields) {
        state.expansionSnapshot = snapshotAddedEntries(currentScan.fields, scopeScan(actionResult.scan).fields);
        result.scan = actionResult.scan;
        result.mutated = true;
        aiAllowance += 2;
        state.declinedActionKey = "";
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
    const remainingPending = formState.unansweredFields(nextScan.fields, { filledIds: new Set(state.filledIds), resolvedIds: new Set(state.unresolved.map(item => item.fieldId)), blockedIds: new Set(state.blockedIds), includeExisting: options.replaceExisting });
    await onEvent("loop_progress", {
      filledCount: (result.filledIds || []).length,
      skippedCount: (result.skipped || []).length,
      unresolvedCount: (generated.unresolved || []).length,
      invalidCount: (generated.invalid || []).length,
      newFieldCount: afterComparison.newFields.length,
      changedFieldCount: afterComparison.changedFields.length,
      disappearedFieldCount: afterComparison.disappearedFields.length,
      remainingPendingCount: remainingPending.length,
      progressCount: state.lastProgress
    });
    await checkpoint(state, result.mutated ? "rescan" : "fill", result.mutated ? "The form changed; checking for additional questions…" : `Applied ${state.totalFilled} answers…`);
  }
  const stranded = formState.unansweredFields(state.currentScan.fields, { filledIds: new Set(state.filledIds), resolvedIds: new Set(state.unresolved.map(item => item.fieldId)), blockedIds: new Set(state.blockedIds), includeExisting: options.replaceExisting });
  if (stranded.length && stopReason !== "stable") await onEvent("fields_stranded", { stopReason, fields: diagnosticFields(stranded) });
  return { state, stopReason, elapsedMs: now() - startedAt };
}

function emptyResult(scan) { return { ok: true, filled: 0, filledIds: [], failed: [], skipped: [], basisCounts: {}, mutated: false, scan }; }
function addValue(values, value) { if (!values.includes(value)) values.push(value); }
function removeValue(values, value) { const index = values.indexOf(value); if (index >= 0) values.splice(index, 1); }
function throwIfCanceled(signal) { if (signal?.aborted) { const error = new Error("Fill canceled."); error.name = "AbortError"; throw error; } }
function actionDecisionKey(scan, actions) { return JSON.stringify([(actions || []).map(action => action.actionId), (scan?.fields || []).filter(field => field.groupId).map(field => [field.groupId, field.entryOrdinal, field.semanticHint, field.currentValue])]); }
function replacementCollectionId(fields, replaceExisting) { const ids = new Set((fields || []).map(field => field.groupId).filter(Boolean)); return replaceExisting && ids.size === 1 && (fields || []).every(field => field.groupId) ? [...ids][0] : ""; }
function suggestionsFromPlan(fields, records) { return (fields || []).flatMap(field => { const value = records?.[Number(field.entryOrdinal) - 1]?.[field.semanticHint]; return value === undefined ? [] : [{ fieldId: field.fieldId, value, basis: "supported" }]; }); }
function plannedAddAction(fields, actions, plans) { for (const action of actions || []) { const groups = [...new Set((fields || []).filter(field => !action.sectionId || field.sectionId === action.sectionId).map(field => field.groupId).filter(Boolean))]; for (const groupId of groups) { const count = Math.max(0, ...(fields || []).filter(field => field.groupId === groupId).map(field => Number(field.entryOrdinal) || 0)); if ((plans[groupId]?.length || 0) > count) return { actionId: action.actionId, type: "add_repeat_entry" }; } } return null; }
function diagnosticFields(fields) { return (fields || []).map(field => ({ fieldId: field.fieldId, label: String(field.label || "").slice(0, 200) })); }
function batchDiagnostics({ pending, expectedFields, batches, source, collectionId = "" }) { return { pendingCount: pending.length, selectedFields: diagnosticFields(expectedFields), remainingBatchCount: Math.max(0, batches.length - 1), source, ...(collectionId ? { collectionId } : {}) }; }
function stopDiagnostics({ decision, pending, availableActions, state, startingAiCalls, aiAllowance }) { return { decision, pendingCount: pending.length, actionCount: availableActions.length, queuedCount: state.queuedSuggestions.length, progressCount: state.lastProgress, aiCalls: state.aiCalls - startingAiCalls, aiAllowance }; }
