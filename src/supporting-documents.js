export const MAX_SUPPORTING_DOCUMENTS = 10;
export const MAX_SUPPORTING_DOCUMENT_CHARS = 200_000;

export function normalizeSupportingDocuments(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const normalized = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.replace(/[\r\n]+/g, " ").trim().slice(0, 200) : "";
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!id || !name || !text || seen.has(id)) continue;
    seen.add(id);
    normalized.push({
      id,
      name,
      type: typeof item.type === "string" ? item.type.trim().slice(0, 20) : "",
      importedAt: typeof item.importedAt === "string" ? item.importedAt : "",
      enabled: item.enabled !== false,
      text
    });
  }

  return normalized;
}

export function validateSupportingDocuments(items) {
  const normalized = normalizeSupportingDocuments(items);
  if (normalized.length !== items.length) throw new Error("One or more supporting files are invalid.");
  if (normalized.length > MAX_SUPPORTING_DOCUMENTS) throw new Error(`Keep no more than ${MAX_SUPPORTING_DOCUMENTS} supporting files.`);
  const characterCount = normalized.reduce((total, document) => total + document.text.length, 0);
  if (characterCount > MAX_SUPPORTING_DOCUMENT_CHARS) {
    throw new Error("Supporting files contain too much text. Keep their combined text under 200,000 characters.");
  }
  return normalized;
}

export function enabledSupportingDocuments(items) {
  return normalizeSupportingDocuments(items).filter(document => document.enabled);
}
