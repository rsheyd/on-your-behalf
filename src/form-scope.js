export const ENTIRE_PAGE_SCOPE = "";

export function availableSections(fields) {
  const seen = new Set();
  const sections = [];
  for (const field of Array.isArray(fields) ? fields : []) {
    const id = String(field?.sectionId || "");
    const label = String(field?.sectionLabel || "").trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, label });
  }
  return sections;
}

export function fieldsInScope(fields, sectionId = ENTIRE_PAGE_SCOPE) {
  const source = Array.isArray(fields) ? fields : [];
  return sectionId ? source.filter(field => field.sectionId === sectionId) : source;
}

export function actionsInScope(actions, sectionId = ENTIRE_PAGE_SCOPE) {
  const source = Array.isArray(actions) ? actions : [];
  return sectionId ? source.filter(action => action.sectionId === sectionId) : source;
}
