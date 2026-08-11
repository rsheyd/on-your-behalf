const DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.5-flash"
};

export function defaultModel(provider) {
  return DEFAULT_MODELS[provider] || "";
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Provider request failed (${response.status}).`;
    throw new Error(message);
  }
  return data;
}

export async function generateSuggestions({ provider, apiKey, model, prompt }) {
  if (!apiKey?.trim()) throw new Error("Add an API key in Settings first.");
  const selectedModel = model?.trim() || defaultModel(provider);

  if (provider === "openai") {
    const data = await requestJson("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        model: selectedModel,
        input: prompt,
        temperature: 0.1,
        text: { format: { type: "json_object" } }
      })
    });
    const output = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    if (!output) throw new Error("OpenAI returned no text response.");
    return output;
  }

  if (provider === "anthropic") {
    const data = await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: selectedModel, max_tokens: 4096, temperature: 0.1, messages: [{ role: "user", content: prompt }] })
    });
    const output = data.content?.find(item => item.type === "text")?.text;
    if (!output) throw new Error("Anthropic returned no text response.");
    return output;
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const data = await requestJson(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      })
    });
    const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
    if (!output) throw new Error("Gemini returned no text response.");
    return output;
  }

  throw new Error("Choose a supported AI provider in Settings.");
}
