function fieldMap(fields) {
  return new Map((fields || []).filter(field => field?.fieldId).map(field => [field.fieldId, field]));
}

export function coherentFieldBatches(fields, maxFields = 25, { wholeRepeatedCollections = false } = {}) {
  const limit = Math.max(1, Number(maxFields) || 25);
  const units = [];
  const unitByKey = new Map();
  for (const field of fields || []) {
    if (!field?.fieldId) continue;
    const section = String(field.sectionId || "page");
    const repeated = field.groupId && Number(field.entryOrdinal) > 0;
    const key = repeated ? `${section}:${field.groupId}${wholeRepeatedCollections ? "" : `:${field.entryOrdinal}`}` : `${section}:field:${field.fieldId}`;
    let unit = unitByKey.get(key);
    if (!unit) {
      unit = { section, fields: [] };
      unitByKey.set(key, unit);
      units.push(unit);
    }
    unit.fields.push(field);
  }
  const batches = [];
  let batch = [];
  let batchSection = "";
  for (const unit of units) {
    const sectionChanged = batch.length && unit.section !== batchSection;
    const wouldOverflow = batch.length && batch.length + unit.fields.length > limit;
    if (sectionChanged || wouldOverflow) {
      batches.push(batch);
      batch = [];
    }
    if (!batch.length) batchSection = unit.section;
    batch.push(...unit.fields);
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function adaptiveAiCallAllowance(fields, maxFields = 25, followUpCalls = 2, batchOptions = {}) {
  return Math.max(1, coherentFieldBatches(fields, maxFields, batchOptions).length) + Math.max(0, Number(followUpCalls) || 0);
}

export function fillLimitReason({ pendingCount = 0, actionCount = 0, queuedCount = 0, elapsedMs = 0, maxDurationMs, domPasses = 0, maxDomPasses, aiCalls = 0, maxAiCalls, progressCount = 0, hasAppliedPass = false } = {}) {
  const hasWork = pendingCount + actionCount + queuedCount > 0;
  if (!hasWork) return "stable";
  if (elapsedMs >= maxDurationMs) return "time_limit";
  if (domPasses >= maxDomPasses) return "dom_limit";
  if (!queuedCount && hasAppliedPass && progressCount <= 0) return "no_progress";
  if (!queuedCount && aiCalls >= maxAiCalls) return "ai_limit";
  return "";
}

export function snapshotReplacement(fields) {
  const repeated = (fields || []).filter(field => field?.fieldId && field.groupId && Number(field.entryOrdinal) > 0);
  return {
    fieldIds: repeated.map(field => field.fieldId),
    entries: [...new Set(repeated.map(field => `${field.groupId}:${field.entryOrdinal}`))]
  };
}

export function extendReplacementSnapshot(snapshot, fields) {
  const entries = new Set(snapshot?.entries || []);
  const fieldIds = [...(snapshot?.fieldIds || [])];
  const seen = new Set(fieldIds);
  for (const field of fields || []) {
    const entry = field?.groupId && Number(field.entryOrdinal) > 0 ? `${field.groupId}:${field.entryOrdinal}` : "";
    if (!entry || !entries.has(entry) || !field.fieldId || seen.has(field.fieldId)) continue;
    seen.add(field.fieldId);
    fieldIds.push(field.fieldId);
  }
  return { fieldIds, entries: [...entries] };
}

export function reconcileSuggestionQueue({ suggestions = [], expectedFields = [], currentFields = [], completedIds = [] } = {}) {
  const expected = fieldMap(expectedFields);
  const current = fieldMap(currentFields);
  const completed = new Set(completedIds);
  return suggestions.filter(suggestion => {
    const fieldId = suggestion?.fieldId;
    return fieldId && !completed.has(fieldId) && expected.has(fieldId) && current.has(fieldId);
  });
}

export function reconcileCheckpointForResume(checkpoint, currentScan) {
  if (!checkpoint || !currentScan?.fields) return checkpoint;
  const current = fieldMap(currentScan.fields);
  const filledIds = (checkpoint.filledIds || []).filter(fieldId => current.get(fieldId)?.empty === false);
  const blockedIds = (checkpoint.blockedIds || []).filter(fieldId => current.has(fieldId));
  return {
    ...checkpoint,
    currentScan,
    filledIds,
    blockedIds,
    queuedSuggestions: reconcileSuggestionQueue({
      suggestions: checkpoint.queuedSuggestions,
      expectedFields: currentScan.fields,
      currentFields: currentScan.fields,
      completedIds: [...filledIds, ...blockedIds]
    })
  };
}

export function replacementPhaseComplete(snapshot, completedIds = []) {
  const completed = new Set(completedIds);
  return (snapshot?.fieldIds || []).every(fieldId => completed.has(fieldId));
}

export function actionsForReplacementPhase(actions, snapshot, completedIds = []) {
  return replacementPhaseComplete(snapshot, completedIds) ? (actions || []) : [];
}

export function snapshotAddedEntries(beforeFields, afterFields) {
  const priorEntries = new Set(snapshotReplacement(beforeFields).entries);
  const added = (afterFields || []).filter(field => {
    const entry = field?.groupId && Number(field.entryOrdinal) > 0 ? `${field.groupId}:${field.entryOrdinal}` : "";
    return entry && !priorEntries.has(entry);
  });
  return snapshotReplacement(added);
}

export function actionsForActiveExpansion(actions, expansionSnapshot, completedIds = []) {
  if (!expansionSnapshot?.fieldIds?.length) return actions || [];
  return replacementPhaseComplete(expansionSnapshot, completedIds) ? (actions || []) : [];
}

export function transitionOperationState(state = {}, event = {}) {
  if (event.type === "start") return { status: "running", progress: 0, error: "" };
  if (event.type === "progress" && state.status === "running") return { ...state, progress: Math.max(state.progress || 0, Number(event.progress) || 0) };
  if (event.type === "pause" && state.status === "running") return { ...state, status: "paused" };
  if (event.type === "resume" && state.status === "paused") return { ...state, status: "running" };
  if (event.type === "complete" && state.status === "running") return { ...state, status: "complete", progress: 1 };
  if (event.type === "fail" && state.status === "running") return { ...state, status: "failed", error: String(event.error || "Fill failed") };
  return state;
}

export function sameFillOptions(left = {}, right = {}) {
  const keys = ["formContext", "includeProfile", "includeSupportingFiles", "answeringPosture", "assumeAffirmative", "allowAssumptions", "includeConsequentialAssumptions", "selectedSectionId", "replaceExisting"];
  return keys.every(key => (left[key] ?? defaultOptionValue(key)) === (right[key] ?? defaultOptionValue(key)));
}

function defaultOptionValue(key) {
  if (key === "includeProfile" || key === "includeSupportingFiles") return true;
  return key === "formContext" || key === "answeringPosture" || key === "selectedSectionId" ? "" : false;
}
