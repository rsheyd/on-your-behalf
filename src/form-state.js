(function initializeOpenFormFillerState(root) {
  if (root.OpenFormFillerState) return;

  function normalizedText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function logicalFieldKey(field, occurrence = 0) {
    const kind = normalizedText(field?.kind) || "input";
    const domId = String(field?.domId || "").trim();
    const name = String(field?.name || "").trim();
    const label = normalizedText(field?.label) || "unlabelled";
    if (kind === "radio" && name) return `name:${kind}:${name}`;
    if (domId) return `id:${domId}`;
    if (name) return `name:${kind}:${name}:${Math.max(0, Number(occurrence) || 0)}`;
    return `label:${kind}:${label}:${Math.max(0, Number(occurrence) || 0)}`;
  }

  function fieldFingerprint(field) {
    const options = Array.isArray(field?.options) ? field.options.map(option => [
      String(option?.value ?? ""),
      normalizedText(option?.label)
    ]) : [];
    return JSON.stringify([
      normalizedText(field?.kind),
      normalizedText(field?.inputType),
      normalizedText(field?.label),
      String(field?.name || ""),
      normalizedText(field?.placeholder),
      normalizedText(field?.formatHint),
      String(field?.min || ""),
      String(field?.max || ""),
      Boolean(field?.required),
      options
    ]);
  }

  function stableFieldId({ logicalKey, currentId = "", identityMap, createId }) {
    if (!logicalKey || !(identityMap instanceof Map)) throw new TypeError("A logical key and identity map are required");
    if (currentId) {
      identityMap.set(logicalKey, currentId);
      return currentId;
    }
    const remembered = identityMap.get(logicalKey);
    if (remembered) return remembered;
    if (typeof createId !== "function") throw new TypeError("A field ID factory is required for new fields");
    const created = String(createId() || "");
    if (!created) throw new TypeError("The field ID factory must return an ID");
    identityMap.set(logicalKey, created);
    return created;
  }

  function fieldMap(fields) {
    const result = new Map();
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!field || typeof field.fieldId !== "string" || !field.fieldId || result.has(field.fieldId)) continue;
      result.set(field.fieldId, field);
    }
    return result;
  }

  function compareFieldScans(previousFields, currentFields) {
    const previous = fieldMap(previousFields);
    const current = fieldMap(currentFields);
    const newFields = [];
    const changedFields = [];
    const unchangedFields = [];
    const disappearedFields = [];

    for (const [fieldId, field] of current) {
      const earlier = previous.get(fieldId);
      if (!earlier) newFields.push(field);
      else if (fieldFingerprint(earlier) !== fieldFingerprint(field)) changedFields.push(field);
      else unchangedFields.push(field);
    }
    for (const [fieldId, field] of previous) {
      if (!current.has(fieldId)) disappearedFields.push(field);
    }
    return { newFields, changedFields, unchangedFields, disappearedFields };
  }

  function pendingFields(comparison, { filledIds = [], resolvedIds = [] } = {}) {
    const filled = new Set(filledIds);
    const resolved = new Set(resolvedIds);
    const seen = new Set();
    const result = [];
    for (const field of comparison?.newFields || []) {
      if (!field?.fieldId || filled.has(field.fieldId) || resolved.has(field.fieldId) || seen.has(field.fieldId)) continue;
      seen.add(field.fieldId);
      result.push(field);
    }
    for (const field of comparison?.changedFields || []) {
      if (!field?.fieldId || filled.has(field.fieldId) || seen.has(field.fieldId)) continue;
      seen.add(field.fieldId);
      result.push(field);
    }
    return result;
  }

  function unansweredFields(fields, { filledIds = [], resolvedIds = [], blockedIds = [] } = {}) {
    const excluded = new Set([...filledIds, ...resolvedIds, ...blockedIds]);
    return [...fieldMap(fields).values()].filter(field => field.empty !== false && !excluded.has(field.fieldId));
  }

  function customOptionDisplayLabel(value, options = []) {
    const target = normalizedText(value);
    const match = options.find(option => normalizedText(option?.value) === target || normalizedText(option?.label) === target);
    return match ? String(match.label || match.value || "").trim() : String(value ?? "").trim();
  }

  function reconcileUnresolved({ previous = [], updates = [], visibleFields = [], answeredIds = [], invalidatedIds = [] } = {}) {
    const visibleIds = new Set(fieldMap(visibleFields).keys());
    const answered = new Set(answeredIds);
    const invalidated = new Set(invalidatedIds);
    const result = new Map();
    for (const item of previous) {
      if (!item?.fieldId || !visibleIds.has(item.fieldId) || answered.has(item.fieldId) || invalidated.has(item.fieldId)) continue;
      result.set(item.fieldId, item);
    }
    for (const item of updates) {
      if (!item?.fieldId || !visibleIds.has(item.fieldId) || answered.has(item.fieldId)) continue;
      result.set(item.fieldId, item);
    }
    return [...result.values()];
  }

  function validSuggestionsForScan(suggestions, expectedFields, currentFields) {
    const expected = fieldMap(expectedFields);
    const current = fieldMap(currentFields);
    const seen = new Set();
    const result = [];
    for (const suggestion of Array.isArray(suggestions) ? suggestions : []) {
      const fieldId = suggestion?.fieldId;
      if (!fieldId || seen.has(fieldId)) continue;
      const expectedField = expected.get(fieldId);
      const currentField = current.get(fieldId);
      if (!expectedField || !currentField || fieldFingerprint(expectedField) !== fieldFingerprint(currentField)) continue;
      seen.add(fieldId);
      result.push(suggestion);
    }
    return result;
  }

  function nextRoundDecision({ completedRounds = 0, maxRounds = 6, pendingCount = 0, progressCount = 0 } = {}) {
    if (pendingCount <= 0) return { continue: false, reason: "stable" };
    if (completedRounds >= maxRounds) return { continue: false, reason: "round_limit" };
    if (completedRounds > 0 && progressCount <= 0) return { continue: false, reason: "no_progress" };
    return { continue: true, reason: "pending_fields" };
  }

  root.OpenFormFillerState = Object.freeze({
    compareFieldScans,
    customOptionDisplayLabel,
    fieldFingerprint,
    logicalFieldKey,
    nextRoundDecision,
    pendingFields,
    reconcileUnresolved,
    stableFieldId,
    unansweredFields,
    validSuggestionsForScan
  });
})(globalThis);
