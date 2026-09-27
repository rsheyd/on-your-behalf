# On Your Behalf Privacy Policy

Effective date: September 27, 2026.

On Your Behalf (OYB) fills web forms using information you provide and an AI provider you select. It has no developer-operated backend or account system. The developer does not receive your profile, API keys, documents, or form requests through OYB.

## Information stored in your browser

OYB stores your profile, extracted supporting-document text, provider API keys, settings, fill checkpoints, and a bounded history of recent run diagnostics in Chrome extension-local storage. Diagnostics may contain field labels, form answers, and page context; they exclude API keys and full profile and supporting-document contents. Optional temporary form context uses browser-session storage when you enable Remember until Chrome closes. Extension-local storage is not a password manager.

## Information sent to your selected AI provider

Starting a fill sends your enabled profile and supporting-file text, temporary context, page origin/path (without query parameters or fragments), title and primary heading, detected field labels and metadata, and existing values in repeated records to the provider you selected: OpenAI, Anthropic, or Google Gemini. Ordinary standalone field values are not intentionally included. Password, payment-card, and one-time-code fields are skipped individually. Your API key authenticates requests to its provider over HTTPS. Conditional forms may require multiple requests.

The initial section scan stays in your browser. Test connection sends a small test prompt and your authentication information to the selected provider; it does not send your profile or form data. Provider requests can incur charges under your provider account. Each provider's own terms, retention, and data-use policies apply to information it receives; OYB does not control those policies.

- [OpenAI privacy policy](https://openai.com/policies/privacy-policy/)
- [Anthropic privacy policy](https://www.anthropic.com/legal/privacy)
- [Google privacy policy](https://policies.google.com/privacy)

## Purpose and sharing

Data is used to generate and apply form answers you request and to provide local status, continuation, and troubleshooting. OYB does not sell user data, use it for advertising, or include analytics or tracking services. Information is transferred to your selected AI provider to provide the extension's form-filling purpose. OYB's use of user data complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Your controls

You choose which sources to include in each fill. Edit or remove your profile and API keys in settings and save the changes; remove supporting documents and save settings; clear temporary context from the popup; and clear run history in Run diagnostics. Removing a source does not remove earlier diagnostic records or information already received by a provider. Uninstalling the extension removes its extension-local data from that Chrome profile. Contact your provider about its retention or deletion controls.

OYB writes answers into the current webpage, where that website may observe them before you submit. OYB never submits forms or clicks navigation/progression controls. Review answers before submitting.

## Changes and contact

Policy changes will be recorded in this document. For privacy questions or private vulnerability reporting, use the contact route in [SECURITY.md](SECURITY.md). Do not post profiles, API keys, or private form answers in public issues.
