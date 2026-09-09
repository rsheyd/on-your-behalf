# Changelog

## 0.6.1

- Kept each indexed explanation box associated with its nearby screening question instead of replacing that context with a generic internal field role.
- Added privacy-bounded diagnostics for batch selection, saved-plan application, loop progress, stop decisions, and fields stranded when a run ends early.
- Allowed replacement runs to mark fields omitted from a saved collection plan as missing information and continue to later ordinary form sections.

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
- Made replacement runs finish their original repeated entries before offering Add another, while preserving unused AI suggestions across dependent-field rescans.
- Made row expansion add and settle one new repeated entry at a time, with explicit action-only decisions and complete-record duplicate checks.
- Moved fill execution into the extension service worker so closing the popup or switching tabs no longer owns or cancels the operation.
- Added session checkpoints, restored active and completed status, and a configuration-free Continue previous fill action after an interruption or safety limit.
- Added section-aware 25-field batching that keeps repeated records together and scales the AI-call allowance to the form instead of using one universal round limit.
- Separated AI-call and DOM-pass limits, added provider-request cancellation, prompt zero-progress stopping, and a five-minute emergency ceiling with resumable checkpoints.
- Raised the page-scan safety cap now that long forms are sent to the AI in bounded batches rather than as one request.
- Kept the service worker alive only while a fill is active so popup closure and tab switching do not interrupt later AI calls or row additions.
- Limited individual provider requests to 25 seconds so a slow response pauses at a resumable checkpoint before Chrome's service-worker fetch cutoff.
- Extracted the production fill loop from Chrome APIs so dynamic replacement and row expansion can be integration-tested headlessly, including an opt-in private OpenAI comparison.
- Extended the adaptive AI allowance when a repeated row is successfully added, allowing additional source records to continue while retaining progress and DOM safety limits.
- Added a Cancel current fill action that aborts provider work and stops before another page mutation while preserving changes already made.
- Added a browser-local, ten-run diagnostic history with captured run settings, compact scan and AI transitions, Copy last run, and Clear history controls.
- Restored the captured replacement and section settings while displaying a reopened run so its button and controls describe the operation that actually ran.
- Prevented the main fill action from silently resuming a paused run with stale settings; changing replacement, scope, context, or answering options now starts a new run.
- Replaced the hard-coded popup update timestamp with a runtime-generated fingerprint of the packaged extension source.
- Normalized gapped repeated-control indexes into visual row order so dynamic forms retain coherent source-record assignments.
- Rejected type-invalid checkbox and choice suggestions and kept those fields eligible for a bounded AI correction attempt.
- Added one bounded confirmation for an unchanged action-only decision so a single missed add-row response does not prematurely end repeated-record expansion.
- Made replacement of repeated sections derive one ordered source-backed collection plan, then reuse it deterministically across field changes and row additions instead of reinterpreting existing values on every AI call.
- Added bounded collection-plan and rejected-value details to copied run diagnostics so missing repeated-record values can be distinguished from validation failures.
- Added nearby shared instructions such as keyword and delimiter guidance to each governed field's format context.
- Tightened repeated-section detection so a mixed section is planned as a collection only when multiple field roles actually repeat across rows.
- Added a persistent toolbar badge and tooltip showing when OYB is running, finished, paused, or needs attention even while its popup is closed.

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
