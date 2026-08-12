const DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.5-flash"
};

export const PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    keyUrl: "https://aistudio.google.com/app/apikey",
    setup: "Sign in to Google AI Studio, accept the terms, then copy or create an API key.",
    accountNote: "Gemini API access is managed separately from the Gemini consumer app. Free API usage may be available."
  },
  openai: {
    name: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    setup: "Create an API key in the OpenAI developer platform, then paste it here.",
    accountNote: "A ChatGPT subscription does not include OpenAI API billing or credits."
  },
  anthropic: {
    name: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    setup: "Create an API key in the Anthropic Console, then paste it here.",
    accountNote: "A Claude subscription does not include Anthropic API billing or credits."
  }
};

export function defaultModel(provider) {
  return DEFAULT_MODELS[provider] || "";
}

async function requestJson(url, options, request = fetch) {
  const response = await request(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Provider request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.code || data?.code || "";
    throw error;
  }
  return data;
}

export function providerErrorMessage(error, provider) {
  const name = PROVIDERS[provider]?.name || "The provider";
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (error?.status === 401 || error?.status === 403 || code.includes("api_key") || message.includes("api key") || message.includes("authentication")) {
    return `${name} did not accept this API key. Check that you copied the complete key and that it is active.`;
  }
  if (message.includes("quota") || message.includes("billing") || message.includes("credit") || message.includes("insufficient")) {
    return `The key works, but this ${name} account has no available API quota or billing credit.`;
  }
  if (error?.status === 404 || message.includes("model") && (message.includes("not found") || message.includes("not available") || message.includes("access"))) {
    return `The selected model is not available to this ${name} account. Check Advanced settings or restore the default model.`;
  }
  if (error?.status === 429) return `${name} is temporarily rate-limiting requests. Wait a moment and try again.`;
  if (error instanceof TypeError || message.includes("failed to fetch") || message.includes("network")) {
    return `OYB could not reach ${name}. Check your connection and try again.`;
  }
  return error?.message || `${name} could not verify this connection.`;
}

export async function testProviderConnection({ provider, apiKey, model, request = fetch }) {
  if (!apiKey?.trim()) throw new Error("Paste an API key or keep a saved key before testing the connection.");
  const selectedModel = model?.trim() || defaultModel(provider);
  const key = apiKey.trim();

  if (provider === "openai") {
    await requestJson("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: selectedModel, input: "Reply with OK.", max_output_tokens: 8 })
    }, request);
    return;
  }

  if (provider === "anthropic") {
    await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model: selectedModel, max_tokens: 1, messages: [{ role: "user", content: "Reply with OK." }] })
    }, request);
    return;
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(key)}`;
    await requestJson(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    }, request);
    return;
  }

  throw new Error("Choose a supported AI provider.");
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
