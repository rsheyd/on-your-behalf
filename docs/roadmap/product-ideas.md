# Product Roadmap

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

### Form-specific context and submission packets

Many consequential forms are driven by facts about a particular event rather than facts that belong in a reusable personal profile. Keep three context sources conceptually separate: durable profile facts, a temporary form-specific record, and the visible state of the current page. Let the user explicitly choose which sources are sent to the configured provider.

Use a freeform **Context for this form** field as the initial bootstrap. If repeated use shows that copying long conversational answers is cumbersome or ambiguous, add a portable Markdown or JSON submission-packet format that ChatGPT, another assistant, or the user can create. A packet could contain one work-search activity, reimbursement, claim, application, or other event record; OYB would preview it and let the user select the record to fill.

Do not make direct access to ChatGPT memories or chat history a product assumption. The OpenAI API's application-managed conversation state is separate from a user's ChatGPT history, and a browser extension should not scrape ChatGPT pages. A future ChatGPT plugin, local tool, or browser-agent workflow could provide an explicit handoff if a supported and appropriately narrow integration becomes available. Preserve the core boundary: conversational software may help assemble the facts, while OYB applies only the context the user deliberately hands to it and never submits the destination form.

### Post-0.4.0 side-panel workspace

After the `0.4.0` conditional-form release, design a Chrome side-panel workspace as the durable replacement for the increasingly dense toolbar popup. The side panel should keep form context, progress, unresolved answers, and review guidance visible alongside the destination page, with enough width and height for readable text and comfortable controls.

The persistent panel must make its target explicit and prevent context from leaking across tabs. Show the active destination hostname or page title, key temporary context and scan state by tab ID, invalidate stale suggestions when the active page changes, and require a fresh scan before filling a different tab. Preserve the existing rule that OYB never submits or activates navigation controls.

Bootstrap the migration by reusing the popup's HTML, styles, and orchestration logic in a responsive extension page. Configure the toolbar action to open the side panel directly only after the tab-targeting behavior is reliable. Retain a small popup only if repeated use demonstrates a meaningful need for a separate quick action.

## Suggested next steps

1. Add an **Add missing fact to profile** flow after filling.
2. Design and implement the post-`0.4.0` side-panel workspace with tab-scoped context and scan state.
3. Evaluate a portable submission-packet format after the temporary form-context workflow has been used repeatedly.
4. Add local profile export and safe re-import.
5. Polish the manual fixture into a first-run example.
6. Use feedback from repeated use to decide whether a structured profile editor is warranted.
