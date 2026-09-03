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
- Added a distinctive plum, coral, and gold OYB proxy-mark icon set at 16, 32, 48, and 128 pixels.
- Added nearby question-text detection for controls without accessible labels, including Guidepoint-style screening questions.
- Prevented radio choices and long select option lists from being mistaken for field questions.
- Allowed newer injected scanner versions to replace their prior message listener cleanly after future extension reloads.
- Simplified and centralized the AI answering policy, with stronger use of concrete details across all enabled sources.
- Added optional affirmative handling for acknowledgements and consent, plus reasonable assumptions with a separate opt-in for consequential declarations.
- Marked inferred answers with an amber outline while keeping all filled answers visibly outlined for review.
- Added support for styled checkboxes and radio buttons that hide the real input behind a visible associated label.
- Kept answer-basis metadata out of the text written into form fields.
- Added a locally populated section dropdown that can limit scanning, AI requests, and filling to fields under one detected heading.
- Updated the fill button label to reflect whether the whole page or one section is selected.
- Added an unchecked per-run option to replace existing answers within the selected page or section scope.
- Added repeated-entry grouping and date-part hints so employment, education, address, dependent, and reference rows remain coherent.
- Allowed the AI to request one recognized, in-scope Add another row per bounded fill round when the enabled sources contain another useful record.
- Fixed same-version development reloads so newly injected scanner logic replaces an older scanner already running on the page.
- Added a version and source-update marker at the bottom of the popup for quickly confirming which unpacked build is loaded.
- Fixed Add another links whose visible contents are floated inside a zero-size wrapper.
- Added lightweight collection, entry, and semantic-role metadata directly to repeated fields while keeping every fillable control in the primary answer list.
- Kept the last fill status and missing-information list visible after the popup closes, until the next fill begins.
- Made repeated-record filling deterministic around controls that reveal or hide related date fields.
- Prevented field-revealing checkbox changes from scrambling the remaining values in a repeated record.
- Clarified indexed field labels and made the add-row decision explicit after the model has seen existing repeated records.

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
