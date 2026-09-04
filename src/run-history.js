export const MAX_RUN_HISTORY = 10;
export const MAX_TRACE_EVENTS = 200;

export function appendRunHistory(history, run, limit = MAX_RUN_HISTORY) {
  return [run, ...(Array.isArray(history) ? history : []).filter(item => item?.operationId !== run?.operationId)].slice(0, Math.max(1, limit));
}

export function appendTrace(trace, event, limit = MAX_TRACE_EVENTS) {
  return [...(Array.isArray(trace) ? trace : []), event].slice(-Math.max(1, limit));
}

export function compactFields(fields, limit = 120) {
  return (fields || []).slice(0, limit).map(({ fieldId, label, groupLabel, entryOrdinal, semanticHint, empty, currentValue }) => ({ fieldId, label, groupLabel, entryOrdinal, semanticHint, empty, currentValue: compactValue(currentValue) }));
}

export function compactSuggestions(items, limit = 120) {
  return (items || []).slice(0, limit).map(({ fieldId, value, basis, reason }) => ({ fieldId, ...(value !== undefined ? { value: compactValue(value) } : {}), ...(basis ? { basis } : {}), ...(reason ? { reason } : {}) }));
}

export function compactCollectionPlan(records, recordLimit = 40, roleLimit = 20) {
  return (records || []).slice(0, recordLimit).map(record => Object.fromEntries(Object.entries(record || {}).slice(0, roleLimit).map(([role, value]) => [String(role).slice(0, 100), compactValue(value)])));
}

function compactValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value ?? "").slice(0, 300);
}
