# Product ideas

## Profile and provider onboarding

The current setup asks a new user to do two fairly intimidating things at once: write an unstructured personal dossier and provision developer credentials. The main opportunity is to turn both into guided flows while keeping the extension local-first.

### Profile experience

- Replace the blank profile textarea as the primary interface with a short, skippable questionnaire covering:
  - Name and contact details
  - Location and eligibility
  - Education
  - Employment
  - Links and online profiles
  - A reusable short biography
  - Optional custom facts
- Present profile categories as editable cards so users can see exactly what information is available to forms.
- Retain an **Additional context** textarea for facts that do not fit the structure.
- Store the profile as structured JSON and render compact, provider-neutral text when constructing a prompt.
- After filling a form, make missing facts actionable—for example, offer to add a requested pronoun or other durable answer to the profile.
- Support local JSON export and import. Consider resume import later, after the basic editing experience works well.

The goal is an incremental profile-building loop rather than expecting users to write a complete profile before their first use.

### Provider and API-key setup

- Show providers as setup cards with plain-language tradeoffs and recommend one default.
- Hide the editable model field under **Advanced settings**.
- Include a provider-specific **Create an API key** link.
- Explain that a consumer ChatGPT, Claude, or Gemini subscription does not necessarily provide API access.
- Add show/hide, paste, clear, and **Test connection** controls for keys.
- Validate the connection before declaring setup complete.
- Show a status such as **Gemini connected** instead of redisplaying the stored key by default.
- Translate invalid-key, quota/billing, unsupported-model, and network failures into useful provider-specific messages.

Suggested onboarding sequence:

1. Welcome
2. Choose a provider
3. Create or paste a key
4. Test the connection
5. Add a basic profile
6. Try the extension on a safe example form

The existing manual form fixture could eventually become a polished first-run demo.

### Product boundary

For the foreseeable use case, retain bring-your-own-key and the local-first architecture. A hosted, keyless service would simplify onboarding, but would also add accounts, billing, secret management, abuse prevention, privacy obligations, and ongoing backend maintenance.

### Suggested implementation order

1. Provider cards, key-creation links, connection testing, and an advanced model setting.
2. Guided profile sections plus freeform additional context.
3. An **Add missing fact to profile** flow after filling.
4. Local profile export and import.
5. Only then consider resume import or a hosted keyless option.
