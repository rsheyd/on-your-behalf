# Product ideas

## Product direction

Keep OYB a small, local-first extension with bring-your-own-key provider access. A hosted, keyless service would simplify onboarding, but would also add accounts, billing, secret management, abuse prevention, privacy obligations, and ongoing backend maintenance.

The goal is to let people start with very little profile information and improve it naturally as they encounter forms, rather than asking them to assemble a complete personal dossier up front.

## Completed foundations

- A flexible, freeform profile with a short starter outline.
- Local import from DOCX, Markdown, plain text, and text-based PDF files.
- An optional extended field guide and Google Docs-friendly profile template.
- Provider cards with plain-language tradeoffs and Gemini as the recommended default.
- Official provider-specific API-key links and explanations of separate API access and billing.
- Saved-key masking, show, hide, clear, and connection-testing controls.
- Plain-language invalid-key, quota or billing, model, rate-limit, and network errors.
- Manual model selection under **Advanced settings**.

## Remaining ideas

### Incremental profile building

After filling a form, make missing durable facts actionable—for example:

> This form asked for your preferred pronouns. Add this to your profile?

Judgment calls that apply only to the current form should remain separate from reusable profile facts.

### Profile portability

- Export the current profile to a local Markdown or JSON file.
- Make re-import safe and predictable without silently overwriting existing information.
- Consider resume-specific assistance only if general document import proves insufficient.

### First-run experience

- Turn the existing manual form fixture into a polished, safe example form.
- Let new users verify scanning, filling, review highlights, and unresolved-question reporting before trying OYB on a real form.
- Consider a short welcome sequence that connects provider setup, basic profile creation, and the example form.

### Structured profile editing

Observe how people use the starter outline and document importer before committing to a structured editor. If freeform editing becomes cumbersome, consider optional, skippable cards for common categories such as contact details, location, education, employment, links, and reusable descriptions, while retaining an **Additional context** area.

## Suggested next steps

1. Add an **Add missing fact to profile** flow after filling.
2. Add local profile export and safe re-import.
3. Polish the manual fixture into a first-run example.
4. Use feedback from repeated use to decide whether a structured profile editor is warranted.
