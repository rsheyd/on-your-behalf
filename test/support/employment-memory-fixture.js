import "../../src/form-state.js";

const formState = globalThis.OpenFormFillerState;

export function employmentMemoryFixture(initialRows, { browserLike = false, rawIndexes = initialRows.map((_, index) => index), jobRole = "job title", paddedMonths = true } = {}) {
  const roles = ["company", jobRole, "current employment", "start month", "start year", "end month", "end year"];
  const rows = initialRows.map(row => ({ ...row }));
  const indexes = [...rawIndexes];
  let addCount = 0;
  const fieldId = (rawIndex, role) => `employment-${rawIndex}-${role.replaceAll(" ", "-")}`;
  const scan = () => ({ ok: true, page: { title: "Employment History" }, actions: [{ actionId: "add-employment", type: "add_repeat_entry", label: "Add Another Company", groupLabel: "Employment History", sectionId: "employment" }], fields: rows.flatMap((row, index) => roles.filter(role => !(row.current && role.startsWith("end "))).map(role => { const value = valueFor(row, role); return { fieldId: fieldId(indexes[index], role), kind: role === "current employment" ? "checkbox" : role.includes("month") || role.includes("year") ? "select" : "input", inputType: role === "current employment" ? "checkbox" : "text", label: role, name: fieldId(indexes[index], role), sectionId: "employment", groupId: "employment", groupLabel: "Employment History", entryOrdinal: index + 1, semanticHint: role, empty: value === "" || value === false, currentValue: value, ...(role.includes("month") ? { options: ["", ...Array.from({ length: 12 }, (_, month) => paddedMonths ? String(month + 1).padStart(2, "0") : String(month + 1))] } : {}), ...(role.includes("year") ? { options: ["", ...Array.from({ length: 30 }, (_, year) => String(2026 - year))] } : {}) }; })) });
  return {
    scan,
    rows,
    get addCount() { return addCount; },
    async fill({ suggestions, expectedFields = [] }) {
      const filledIds = [];
      let remainingSuggestions = [];
      let mutated = false;
      const ordered = browserLike ? formState.orderSuggestionsForFill(suggestions, scan().fields) : suggestions;
      for (let index = 0; index < ordered.length; index += 1) {
        const before = scan();
        const suggestion = ordered[index];
        const match = /^employment-(\d+)-(.+)$/.exec(suggestion.fieldId);
        const rowIndex = indexes.indexOf(Number(match?.[1]));
        if (!match || rowIndex < 0) continue;
        const role = match[2].replaceAll("-", " ");
        setValue(rows[rowIndex], role, suggestion.value);
        filledIds.push(suggestion.fieldId);
        if (browserLike && before.fields.length !== scan().fields.length) { mutated = true; remainingSuggestions = ordered.slice(index + 1); break; }
      }
      const after = scan();
      return { ok: true, filled: filledIds.length, filledIds, failed: [], skipped: [], remainingSuggestions, basisCounts: { supported: filledIds.length, inferred: 0, chosen: 0 }, mutated, scan: after };
    },
    async activate() { rows.push({ company: "", title: "", current: false, startMonth: "", startYear: "", endMonth: "", endYear: "" }); indexes.push(Math.max(-1, ...indexes) + 1); addCount += 1; return { ok: true, activated: true, scan: scan() }; }
  };
}

function valueFor(row, role) {
  return ({ company: row.company, "job title": row.title, "job function": row.title, "current employment": Boolean(row.current), "start month": row.startMonth, "start year": row.startYear, "end month": row.endMonth, "end year": row.endYear })[role] ?? "";
}

function setValue(row, role, value) {
  if (role === "company") row.company = String(value);
  else if (role === "job title" || role === "job function") row.title = String(value);
  else if (role === "current employment") { row.current = value === true || String(value).toLowerCase() === "true"; if (row.current) { row.endMonth = ""; row.endYear = ""; } }
  else if (role === "start month") row.startMonth = String(value);
  else if (role === "start year") row.startYear = String(value);
  else if (role === "end month") row.endMonth = String(value);
  else if (role === "end year") row.endYear = String(value);
}
