const SENSITIVE_AUTOCOMPLETE = new Set([
  "cc-name", "cc-given-name", "cc-additional-name", "cc-family-name",
  "cc-number", "cc-exp", "cc-exp-month", "cc-exp-year", "cc-csc", "cc-type",
  "current-password", "new-password", "one-time-code"
]);

const SENSITIVE_TEXT = /(?:password|passcode|passwd|credit\s*card|card\s*number|cardholder|security\s*code|cvv|cvc|verification\s*code|one[- ]?time\s*(?:code|password)|\botp\b)/i;

export function isSensitiveField(field) {
  if ((field.type || "").toLowerCase() === "password") return true;
  const autocomplete = (field.autocomplete || "").toLowerCase().trim().split(/\s+/).pop();
  if (SENSITIVE_AUTOCOMPLETE.has(autocomplete)) return true;
  return SENSITIVE_TEXT.test([
    field.label,
    field.name,
    field.id,
    field.placeholder,
    field.autocomplete
  ].filter(Boolean).join(" "));
}

export function normalizeSuggestion(raw) {
  if (!raw || typeof raw !== "object") return null;
  const fieldId = typeof raw.fieldId === "string" ? raw.fieldId.trim() : "";
  if (!fieldId) return null;
  if (typeof raw.value === "string" || typeof raw.value === "boolean" || typeof raw.value === "number") {
    return { fieldId, value: raw.value };
  }
  return null;
}

export function uniqueSuggestions(items) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeSuggestion(item);
    if (!normalized || seen.has(normalized.fieldId)) continue;
    seen.add(normalized.fieldId);
    result.push(normalized);
  }
  return result;
}

export function trimText(value, maxLength = 500) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
