# Changelog

## 0.6.0

- Added a per-fill answering posture with Strongest truthful case, Exact experience only, and Leave uncertain answers open options.
- Allowed general model knowledge to interpret terminology while keeping personal claims grounded exclusively in the saved profile and temporary context.
- Added explicit safeguards against inferring product use, pricing, discounting, sales, or go-to-market responsibility from general knowledge or employer association.
- Added profile guidance for distinguishing direct experience, transferable experience, commercial responsibility, and limitations.
- Fixed empty-result reporting so every omitted field appears as needed information instead of leaving the promised list blank.
- Added a separate supporting-files library alongside the editable profile.
- Added multi-file import, per-file enablement and removal, and combined size and count safeguards.
- Added a per-fill control for including or excluding all enabled supporting files.
- Kept supporting documents separately labeled in provider prompts, with the user-reviewed profile taking precedence when sources conflict.
- Added a dedicated OYB extension and toolbar icon set at 16, 32, 48, and 128 pixels.
- Added nearby question-text detection for controls without accessible labels, including Guidepoint-style screening questions.
- Prevented radio choices and long select option lists from being mistaken for field questions.
- Allowed newer injected scanner versions to replace their prior message listener cleanly after future extension reloads.

## 0.4.0

- Added bounded multi-round filling for forms whose visible fields and option lists change after earlier answers.
- Added stable field identity, stale-suggestion rejection, user-value preservation, and delayed AJAX settling for custom selects.
- Added temporary form-specific context with an option to exclude the saved profile from a fill request.
- Added opt-in browser-session context retention and an immediate clear action without merging temporary notes into the saved profile.
- Improved PrimeFaces-style custom-select support by mapping hidden option values to visible labels and activating nested menu triggers.
- Limited scans to the page's main content region when available so unrelated site-wide controls are excluded.
- Increased popup width, typography, textarea size, spacing, and control hit areas for readability.
- Updated the OpenAI connection check to satisfy the provider's minimum output-token requirement.

## 0.3.3

- Added clearly labeled starter-template, file-import, and extended field-guide paths directly to profile settings, with contextual format and privacy guidance.
- Added guided provider selection, official API-key setup links, saved-key masking, connection testing, and plain-language error guidance.
- Moved manual model selection into Advanced settings.

## 0.3.2

- Added a short Google Docs-friendly starter profile plus an optional extended field guide with privacy guidance, safe migration tips, and OYB import instructions.

## 0.3.1

- Generalized file import so supported documents can contain any profile-relevant content, rather than requiring resume content.
- Replaced resume-specific formatting assumptions with generic heading and list detection.
- Added a warning that imported profile text may be sent to the selected AI provider when filling forms.

## 0.3.0

- Added local import from DOCX, Markdown, plain text, and text-based PDF files for filling in the user profile.
- Added light Markdown formatting and an editable review step before imported profile text is saved.
- Added clear guidance for formats that preserve structure best and for unsupported scanned PDFs.

## 0.2.1

- Named the extension On Your Behalf (OYB) for its first public repository release.
- Added staged scan, generation, and fill progress instead of a static waiting state.
- Added immediate field-count and provider feedback while answers are generated.
- Added elapsed-time reporting and a clearer message for longer generations.

## 0.2.0

- Added post-fill reporting for factual information missing from the profile.
- Added separate labeling for questions that require current user judgment.
- Kept not-applicable fields out of the visible profile-gap list.
- Separated missing information from technical field-matching failures.

## 0.1.0

- Added a single flexible text profile stored in Chrome extension-local storage.
- Added bring-your-own-key support for Google Gemini, OpenAI, and Anthropic, with keys stored separately by provider.
- Added one-click scanning, suggestion generation, and in-page filling with review highlights.
- Added inputs, textareas, checkboxes, radio groups, native selects, and common ARIA combobox support.
- Added individual filtering for password, payment-card, and authentication-code fields.
- Prevented automatic submission and navigation actions by design.
- Added unit tests and a manual form-compatibility fixture.
- Added input-type and validation-format context so date suggestions follow each form's expected representation.
