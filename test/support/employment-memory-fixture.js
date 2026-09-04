const roles = ["company", "job title", "current employment", "start month", "start year", "end month", "end year"];

export function employmentMemoryFixture(initialRows) {
  const rows = initialRows.map(row => ({ ...row }));
  let addCount = 0;
  const fieldId = (entry, role) => `employment-${entry}-${role.replaceAll(" ", "-")}`;
  const scan = () => ({ ok: true, page: { title: "Employment History" }, actions: [{ actionId: "add-employment", type: "add_repeat_entry", label: "Add Another Company", groupLabel: "Employment History", sectionId: "employment" }], fields: rows.flatMap((row, index) => roles.filter(role => !(row.current && role.startsWith("end "))).map(role => { const value = valueFor(row, role); return { fieldId: fieldId(index + 1, role), kind: role === "current employment" ? "checkbox" : role.includes("month") || role.includes("year") ? "select" : "input", inputType: role === "current employment" ? "checkbox" : "text", label: role, name: fieldId(index + 1, role), sectionId: "employment", groupId: "employment", groupLabel: "Employment History", entryOrdinal: index + 1, semanticHint: role, empty: value === "" || value === false, currentValue: value, ...(role.includes("month") ? { options: ["", ...Array.from({ length: 12 }, (_, month) => String(month + 1).padStart(2, "0"))] } : {}), ...(role.includes("year") ? { options: ["", ...Array.from({ length: 30 }, (_, year) => String(2026 - year))] } : {}) }; })) });
  return {
    scan,
    rows,
    get addCount() { return addCount; },
    async fill({ suggestions }) {
      const before = scan();
      const filledIds = [];
      for (const suggestion of suggestions) {
        const match = /^employment-(\d+)-(.+)$/.exec(suggestion.fieldId);
        if (!match || !rows[Number(match[1]) - 1]) continue;
        const role = match[2].replaceAll("-", " ");
        setValue(rows[Number(match[1]) - 1], role, suggestion.value);
        filledIds.push(suggestion.fieldId);
      }
      const after = scan();
      return { ok: true, filled: filledIds.length, filledIds, failed: [], skipped: [], remainingSuggestions: [], basisCounts: { supported: filledIds.length, inferred: 0, chosen: 0 }, mutated: before.fields.length !== after.fields.length, scan: after };
    },
    async activate() { rows.push({ company: "", title: "", current: false, startMonth: "", startYear: "", endMonth: "", endYear: "" }); addCount += 1; return { ok: true, activated: true, scan: scan() }; }
  };
}

function valueFor(row, role) {
  return ({ company: row.company, "job title": row.title, "current employment": Boolean(row.current), "start month": row.startMonth, "start year": row.startYear, "end month": row.endMonth, "end year": row.endYear })[role] ?? "";
}

function setValue(row, role, value) {
  if (role === "company") row.company = String(value);
  else if (role === "job title") row.title = String(value);
  else if (role === "current employment") { row.current = value === true || String(value).toLowerCase() === "true"; if (row.current) { row.endMonth = ""; row.endYear = ""; } }
  else if (role === "start month") row.startMonth = String(value);
  else if (role === "start year") row.startYear = String(value);
  else if (role === "end month") row.endMonth = String(value);
  else if (role === "end year") row.endYear = String(value);
}
