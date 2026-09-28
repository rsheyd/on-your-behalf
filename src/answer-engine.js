import { buildPrompt, parseCollectionPlan, parseFormAnalysis } from "./prompt.js";
import { generateSuggestions } from "./providers.js";

export async function analyzeForm({ profile = "", supportingDocuments = [], formContext = "", provider = "", apiKey = "", model = "", answeringPosture, assumeAffirmative = false, allowAssumptions = false, includeConsequentialAssumptions = false, replaceExisting = false, planCollection = false, page = {}, fields = [], recordContext = [], actions = [], signal, request }) {
  const selectedProfile = String(profile || "").trim();
  const selectedContext = String(formContext || "").trim();
  if (!selectedProfile && !supportingDocuments.length && !selectedContext) throw new Error("Include your saved profile or supporting files, or add context for this form.");
  const prompt = buildPrompt({ profile: selectedProfile, supportingDocuments, formContext: selectedContext, answeringPosture, assumeAffirmative, allowAssumptions, includeConsequentialAssumptions, replaceExisting, planCollection, page, fields, recordContext, actions });
  const text = await generateSuggestions({ provider, apiKey, model, prompt, signal, ...(request ? { request } : {}) });
  if (!planCollection) return parseFormAnalysis(text, fields, actions);
  const parsedPlan = parseCollectionPlan(text, fields);
  return { plan: parsedPlan.records, planInvalid: parsedPlan.invalid, suggestions: [], unresolved: [], actions: [] };
}
