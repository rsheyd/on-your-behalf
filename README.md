# On Your Behalf

An open-source, local-first Chrome extension that fills web forms from a personal text profile using your choice of AI provider.

**On Your Behalf (OYB)** fills forms from a profile you control, while leaving every answer and the final submission in your hands.

Open a form, click the extension, and choose **Scan and fill this page**. The extension finds non-sensitive fields, asks the selected AI provider for profile-grounded suggestions, and places those suggestions directly into the page. Filled fields receive a green outline so you can review and edit every answer before submitting the form yourself.

## Table of contents

- [On Your Behalf](#on-your-behalf)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Install locally in Chrome](#install-locally-in-chrome)
  - [Privacy and security model](#privacy-and-security-model)
  - [Test](#test)
  - [Product ideas](#product-ideas)
  - [Project structure](#project-structure)
  - [Current limitations](#current-limitations)
  - [License](#license)

## Features

- Uses one flexible, plain-text profile instead of a rigid collection of profile fields.
- Imports editable profile text locally from DOCX, Markdown, plain text, and text-based PDF documents.
- Supports Google Gemini, OpenAI, and Anthropic with your own API key.
- Fills text inputs, textareas, checkboxes, radio groups, native selects, and common ARIA comboboxes.
- Reports profile facts that are missing and questions that require the user's judgment.
- Handles React-style controlled text fields using native value setters and browser events.
- Skips password, payment-card, and authentication-code fields individually.
- Never submits a form or clicks a next/continue button.
- Stores the profile, provider choice, model, and provider-specific API keys in Chrome extension-local storage.
- Has no backend, account, analytics, or telemetry.
- Uses `activeTab`: it can inspect a page only after you click the extension's fill action.

## Install locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory—the directory containing `manifest.json`.
5. Pin **On Your Behalf** from Chrome's Extensions menu.
6. Open the extension and select **Settings**.
7. Add a text profile, select a provider and model, and paste your API key.
8. Open a web form, click the extension, and select **Scan and fill this page**.
9. Review every green-outlined answer before submitting the form yourself.

In Settings, you can import any profile-relevant document in a supported format instead of entering the profile by hand. DOCX, Markdown, and plain text preserve structure most reliably. Text-based PDFs are supported, but multi-column layouts may extract out of order; scanned PDFs are not supported. Imported text stays editable, may be sent to your selected AI provider when filling forms, and is not saved until you choose **Save settings**.

After filling, the popup lists factual answers missing from your profile and questions that require a decision. Use **Open profile settings** to add durable facts; judgment calls remain for the current form.

After changing source files, click the extension's reload button on `chrome://extensions` before testing again.

## Privacy and security model

The extension has no server of its own. Your profile and provider-specific API keys are stored using `chrome.storage.local`, and a form request goes directly from the extension to the provider you selected. Chrome extension-local storage is isolated from normal webpages, but it is not a dedicated password manager or hardware-backed secret store.

The extension sends the selected provider:

- Your text profile.
- The page origin/path, title, and primary heading. URL query parameters and fragments are removed.
- Labels and metadata for the detected non-sensitive form fields.

It does not intentionally send current field values. Page text is treated as untrusted input in the AI prompt, and returned suggestions are restricted to field identifiers created during the current scan. These controls reduce prompt-injection risk but cannot eliminate it. Review suggestions before submitting sensitive or consequential forms.

## Test

Requires Node.js 18 or newer. The runtime PDF library is vendored so the unpacked extension does not need a build step; `npm install` is needed only when updating that library.

```bash
npm test
npm run check
```

See `DEVELOPMENT.md` for the manual Chrome test loop.

## Product ideas

Potential improvements to profile editing, API-key setup, and first-run onboarding are collected in [`PRODUCT-IDEAS.md`](PRODUCT-IDEAS.md).

## Project structure

- `manifest.json` — Manifest V3 extension configuration and version.
- `src/background.js` — AI request orchestration.
- `src/content.js` — page scanning and filling.
- `src/form-core.js`, `src/prompt.js`, `src/providers.js`, and `src/document-import.js` — standalone form, prompt, parsing, provider, and document-import logic.
- `src/vendor/` — browser-ready PDF.js distribution with its license.
- `src/popup.*` — compact scan-and-fill action.
- `src/options.*` — profile and provider settings.
- `test/*.test.js` — unit tests for standalone logic.
- `test/manual-form.html` — a manual compatibility fixture.
- `PRODUCT-IDEAS.md` — product and onboarding ideas under consideration.

## Current limitations

- Custom selects vary widely; v1 supports common visible ARIA `combobox`/`option` patterns, not every component library.
- Cross-origin iframes and closed shadow roots are not scanned.
- Dynamically added form steps require another scan.
- File uploads and rich-text editors are skipped.
- Provider keys are stored locally but are not protected like credentials in a password manager.
- There is no Ollama support yet.
- Scanned PDFs require OCR and cannot be imported; complex PDF columns may extract out of order.

## License

On Your Behalf is available under the MIT License. See `LICENSE`.
