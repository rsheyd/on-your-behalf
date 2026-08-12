# Changelog

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
