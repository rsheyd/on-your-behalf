import { buildPrompt, parseFormAnalysis } from "./prompt.js";
import { generateSuggestions } from "./providers.js";
import { enabledSupportingDocuments } from "./supporting-documents.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GENERATE_SUGGESTIONS") return false;

  handleGenerate(message.payload)
    .then(analysis => sendResponse({ ok: true, ...analysis }))
    .catch(error => {
      console.error("Suggestion generation failed", error);
      sendResponse({ ok: false, error: error.message || "Suggestion generation failed." });
    });
  return true;
});

async function handleGenerate({ page, fields, recordContext = [], actions = [], formContext = "", includeProfile = true, includeSupportingFiles = true, answeringPosture, assumeAffirmative = false, allowAssumptions = false, includeConsequentialAssumptions = false }) {
  const { profile = "", supportingDocuments = [], provider = "", apiKeys = {}, model = "" } = await chrome.storage.local.get([
    "profile", "supportingDocuments", "provider", "apiKeys", "model"
  ]);
  const selectedProfile = includeProfile ? profile.trim() : "";
  const selectedSupportingDocuments = includeSupportingFiles ? enabledSupportingDocuments(supportingDocuments) : [];
  const selectedContext = String(formContext || "").trim();
  if (!selectedProfile && !selectedSupportingDocuments.length && !selectedContext) throw new Error("Include your saved profile or supporting files, or add context for this form.");
  const prompt = buildPrompt({ profile: selectedProfile, supportingDocuments: selectedSupportingDocuments, formContext: selectedContext, answeringPosture, assumeAffirmative, allowAssumptions, includeConsequentialAssumptions, page, fields, recordContext, actions });
  const text = await generateSuggestions({ provider, apiKey: apiKeys[provider] || "", model, prompt });
  return parseFormAnalysis(text, fields, actions);
}
