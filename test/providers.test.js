import test from "node:test";
import assert from "node:assert/strict";
import { providerErrorMessage, testProviderConnection } from "../src/providers.js";

test("connection checks send a minimal request for each provider", async () => {
  for (const provider of ["gemini", "openai", "anthropic"]) {
    let call;
    await testProviderConnection({
      provider,
      apiKey: "secret-key",
      request: async (url, options) => {
        call = { url, options };
        return { ok: true, status: 200, text: async () => "{}" };
      }
    });
    assert.equal(call.options.method, "POST");
    assert.match(call.options.body, /Reply with OK/);
  }
});

test("connection checks reject missing keys before making a request", async () => {
  await assert.rejects(
    () => testProviderConnection({ provider: "openai", apiKey: "", request: async () => assert.fail("should not fetch") }),
    /Paste an API key/
  );
});

test("provider errors are translated into useful setup guidance", () => {
  assert.match(providerErrorMessage(Object.assign(new Error("Unauthorized"), { status: 401 }), "openai"), /did not accept/);
  assert.match(providerErrorMessage(new Error("insufficient quota"), "gemini"), /no available API quota/);
  assert.match(providerErrorMessage(Object.assign(new Error("model not found"), { status: 404 }), "anthropic"), /model is not available/);
  assert.match(providerErrorMessage(Object.assign(new Error("Too many requests"), { status: 429 }), "openai"), /rate-limiting/);
  assert.match(providerErrorMessage(new TypeError("Failed to fetch"), "gemini"), /could not reach/);
});
