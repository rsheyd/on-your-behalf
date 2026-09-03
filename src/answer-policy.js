export const ANSWER_BASES = Object.freeze(["supported", "inferred", "chosen"]);

export function buildAnsweringPolicy({ assumeAffirmative = false, allowAssumptions = false, includeConsequentialAssumptions = false } = {}) {
  const rules = [
    "Use all enabled user sources together, prefer concrete relevant details over generic summaries, and match the field's requested scope and length.",
    "Give the strongest answer supported by those sources without contradicting the user's information or presenting adjacent experience as direct experience.",
    "Mark answers grounded in user sources as supported."
  ];
  if (assumeAffirmative) rules.push("For acknowledgements, consent, authorization, participation, and acceptance choices, select the affirmative option and mark it chosen.");
  if (allowAssumptions) {
    rules.push("When user sources neither answer nor contradict a question, you may select the most likely answer and mark it inferred.");
    if (!includeConsequentialAssumptions) rules.push("Do not infer criminal or legal history, medical or financial facts, conflicts of interest, eligibility, or other consequential attestations.");
  }
  return `ANSWERING POLICY:\n${rules.map(rule => `- ${rule}`).join("\n")}`;
}
