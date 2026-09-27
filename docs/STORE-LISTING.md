# Chrome Web Store submission

This is the canonical draft for the first OYB submission, prepared against version 0.6.5. Confirm the dashboard's current fields before submitting. Extension ID and published listing URL: pending first upload. The package version comes from manifest.json; do not claim that a GitHub release is already available in the Web Store.

## Listing copy

**Name:** On Your Behalf

**Summary:** Fill web forms from your profile or temporary context using your choice of AI provider.

**Suggested category:** Productivity (confirm available dashboard categories).

**Detailed description:**

On Your Behalf helps fill web forms from your saved profile, supporting files, or context for a particular form. Choose OpenAI, Anthropic, or Google Gemini and supply your own provider API key. Provider usage may cost money and requires a working provider account with API access.

Choose a form section or the entire page, choose how cautiously OYB should answer, and start a fill. OYB supports ordinary inputs, selects, checkboxes, radio groups, and many conditional and repeated forms. It can continue a paused run and report missing information. Import profile or supporting text from Markdown, plain text, DOCX, or text-based PDF files.

Your information is stored in your browser. When you start a fill, enabled source information and relevant form metadata are sent directly to your selected AI provider. OYB has no backend or developer account system. AI-generated answers may be incorrect: review and edit them before submitting. OYB never submits forms or clicks next/continue controls and skips sensitive fields individually. Custom widgets, scanned PDFs, and some complex forms may not work.

## Privacy and permissions

**Single purpose:** Help users fill web forms from user-provided information using a user-selected AI provider.

**Privacy policy URL:** https://github.com/rsheyd/on-your-behalf/blob/main/PRIVACY.md (verify that it is publicly accessible after committing and pushing).

- activeTab: access the current page after the user invokes OYB.
- scripting: inject the form scanner and apply generated answers on that page.
- storage: save profile, supporting text, provider credentials, settings, temporary context, checkpoints, and local diagnostics.
- alarms: clear the completion toolbar indicator after its bounded display interval.
- Provider host permissions: send authenticated HTTPS requests to api.openai.com, api.anthropic.com, or generativelanguage.googleapis.com. No persistent access to arbitrary websites is requested.
- Remote code: executable code and PDF parsing dependencies ship inside the package; provider responses are parsed as answer data.

Complete the dashboard's data categories based on actual handling and transmission. OYB handles user-provided personal information, website/form content, and authentication information and transfers selected information to an AI provider. Do not copy Markdown Capture's no-data-collected declarations. Profiles and supporting files can contain additional sensitive categories; review the dashboard definitions against PRIVACY.md and the current runtime. Keep Limited Use certifications consistent with actual behavior.

## Reviewer instructions

1. Install OYB and open settings. Select Google Gemini and expand Advanced settings to set the model to `gemini-flash-latest`. Use the dedicated test key supplied separately in the private dashboard reviewer instructions, then click Test connection and save settings. There is no OYB login. The dedicated key passed OYB’s connection test on September 27, 2026 with `gemini-flash-latest`. The key still needs to be entered in the private dashboard field. OYB 0.6.5 defaults to `gemini-flash-latest`. Existing settings keep their saved model; use Restore default model and save settings if upgrading from an older version.
2. Save a synthetic profile such as: “My name is Alex Example. I am a software engineer with five years of experience. My preferred language is English.” Never use private developer profile material.
3. Open a simple form with name, occupation, and language fields. For a reproducible fixture, serve this repository with `python3 -m http.server 8765` and open `http://localhost:8765/test/manual-form.html`.
4. Open OYB, select the intended section, and start a fill. Review the answers and missing-information report. Confirm that sensitive fields stay empty and submit/navigation counters stay zero.
5. Inspect supporting-file import, source toggles, and paused-run continuation if needed. Invalid or unavailable provider access should produce a clear error.

Recommended access plan: supply a dedicated test credential from a separate provider project through the private reviewer instructions, with minimal practical permissions/usage limits and monitoring. Supply the provider and an available model alongside the key; revoke the credential after review. Do not rely on reviewers creating and funding their own API accounts. Roman has provisioned and tested the credential; it must still be entered privately in the dashboard before submission. Do not put credentials in this repository, public listing, screenshots, or release notes. Confirm that the reviewer has a usable test path before submitting.

## Assets and submission checklist

- Fresh submission assets are ready in store-assets/: three 1280×800 PNG screenshots and the required 440×280 small promotional tile. See store-assets/README.md for provenance and order. The listing icon is icons/icon-128.png.
- Roman reported completing the extracted-ZIP smoke test on September 27, 2026 for version 0.6.4. Version 0.6.5 changes the Gemini default; the earlier smoke test does not certify this newer ZIP. A focused check of Gemini setup and a synthetic fill is required before submission.
- Run `npm test`, `npm run check`, and `npm run package`.
- For future releases, extract the generated ZIP into a fresh directory, load it unpacked in Chrome, and complete the relevant DEVELOPMENT.md smoke checks. Check service-worker errors, imports, provider calls, source toggles, sensitive-field skipping, and zero submit/navigation attempts.
- Commit release preparation, preview with `npm run release -- --dry-run`, and publish the GitHub release with `npm run release` when ready.
- Upload the exact verified ZIP to the developer dashboard; complete listing, privacy declarations, permission justifications, reviewer access, and graphics. Save the assigned extension ID here.
- Submit for review manually. Record approved/published store version separately from the GitHub release. Future uploaded versions must increase beyond the version already uploaded.

References: [Chrome publishing guide](https://developer.chrome.com/docs/webstore/publish), [user data policy](https://developer.chrome.com/docs/webstore/user_data), and [listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements).

## Private reviewer field template

Provide the following directly in the dashboard, replacing placeholders there only: “Select Google Gemini in OYB settings. Expand Advanced settings and set the model to gemini-flash-latest. Use the dedicated review API key [KEY]. Save settings, then follow the synthetic-profile steps above. This credential is provided only for reviewing OYB.” Verify the dedicated key/model combination before sending it; never commit the filled template.
