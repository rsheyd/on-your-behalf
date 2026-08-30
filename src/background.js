import { buildPrompt, parseFormAnalysis } from "./prompt.js";
import { generateSuggestions } from "./providers.js";

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

async function handleGenerate({ page, fields, formContext = "", includeProfile = true }) {
  const { profile = "", provider = "", apiKeys = {}, model = "" } = await chrome.storage.local.get([
    "profile", "provider", "apiKeys", "model"
  ]);
  const selectedProfile = includeProfile ? profile.trim() : "";
  const selectedContext = String(formContext || "").trim();
  if (!selectedProfile && !selectedContext) throw new Error("Include your saved profile or add context for this form.");
  const prompt = buildPrompt({ profile: selectedProfile, formContext: selectedContext, page, fields });
  const text = await generateSuggestions({ provider, apiKey: apiKeys[provider] || "", model, prompt });
  return parseFormAnalysis(text, fields);
}
