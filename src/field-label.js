(function initializeOpenFormFillerLabels(root) {
  if (root.OpenFormFillerLabels) return;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function withoutOptions(value, optionLabels) {
    let remainder = normalize(value);
    for (const option of [...new Set(optionLabels.map(normalize).filter(Boolean))].sort((a, b) => b.length - a.length)) {
      const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      remainder = remainder.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "gi"), " ");
    }
    return normalize(remainder);
  }

  function meaningful(value, optionLabels = []) {
    const normalized = normalize(value);
    if (normalized.length < 2 || normalized.length > 1000) return false;
    return withoutOptions(normalized, optionLabels).length >= 2;
  }

  function chooseFieldLabel({ primaryCandidates = [], ancestorCandidates = [], optionLabels = [], fallback = "", maxLength = 500 } = {}) {
    const primary = primaryCandidates.map(normalize).find(candidate => meaningful(candidate, optionLabels));
    const contextual = ancestorCandidates.map(normalize).find(candidate => meaningful(candidate, optionLabels));
    const chosen = primary || contextual || normalize(fallback);
    return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1)}…` : chosen;
  }

  function chooseInstructionHint(candidates = [], maxLength = 400) {
    const cue = /\b(?:please|instructions?|keywords?|commas?|separate|format|enter|provide|specify|maximum|minimum|required)\b/i;
    for (const candidate of candidates.map(normalize)) {
      const sentences = candidate.match(/[^.!?]+[.!?]?/g) || [];
      const matches = sentences.map(normalize).filter(sentence => sentence.length >= 10 && cue.test(sentence));
      if (!matches.length) continue;
      const chosen = matches.join(" ");
      return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1)}…` : chosen;
    }
    return "";
  }

  root.OpenFormFillerLabels = Object.freeze({ chooseFieldLabel, chooseInstructionHint, meaningful, withoutOptions });
})(globalThis);
