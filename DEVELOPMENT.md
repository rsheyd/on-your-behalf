# Development

The project has no build step. Load the repository directory directly as an unpacked Chrome extension.

For contribution expectations and the safety invariants that every change must preserve, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test` and `npm run check`.
3. Open `chrome://extensions` and reload **On Your Behalf**.
4. Serve this repository over HTTP and open `test/manual-form.html` or `test/conditional-form.html` in Chrome. Extension content scripts cannot run on `file://` pages unless the user separately enables file access.
5. Exercise the popup action and inspect the extension service worker for provider or messaging errors.

For example:

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765/test/manual-form.html`.

## Manual smoke checks

Test at least:

- A page containing text inputs and textareas.
- Native selects, radio groups, and checkboxes.
- The ARIA combobox in `test/manual-form.html`.
- The custom comboboxes and replaced dependent subtree in `test/conditional-form.html`.
- Both conditional activity branches, including switching from Employer Contact to Work Search Preparation Activity and confirming that employer-only fields disappear.
- The delayed dependent update and the extra Other Activity Notes field in `test/conditional-form.html`.
- A site-wide search field outside the fixture's main content is not included in fill requests.
- Custom options remain fillable when the visible menu provides labels but keeps option values only in a hidden backing select.
- One popup action reaches the final dependent fields after delayed custom-select updates.
- Temporary context can be used with the saved profile disabled, restored after reopening the popup when session retention is enabled, and removed with Clear context.
- The fixture counters remain at zero for submit and navigation attempts after OYB runs.
- A React or Vue controlled input.
- A form containing a password field alongside ordinary fields; only the password must be skipped.
- A payment-card and one-time-code field; each must remain empty.
- A page with no form fields.
- Missing profile and missing API key errors.
- File import from DOCX, Markdown, plain text, and a text-based PDF.
- A scanned PDF produces an unsupported-format message instead of changing the profile.
- Importing over a non-empty profile asks for confirmation and does not save automatically.
- Switching providers preserves the current provider's entered or saved key and model choice.
- Saved keys are masked; newly entered keys can be shown, hidden, and cleared.
- Each supported provider connects successfully with a real API key.
- The OpenAI connection check uses a valid minimum output-token value.
- Connection testing reports invalid-key, quota or billing, unavailable-model, rate-limit, and network failures clearly.
- Clearing a saved key does not become permanent until settings are saved.
- Editing a filled value before manually submitting.
- Confirmation that submit, next, and continue buttons are never clicked.

## Versioning

The extension has a single version source: the `version` field in `manifest.json`. The private `package.json` intentionally has no version because this project is not published to npm.

Update `manifest.json`, update `CHANGELOG.md`, run automated tests, and complete the relevant manual smoke checks before creating a release.

## Vendored import libraries

PDF file import uses a browser-ready copy of PDF.js under `src/vendor/`; its license is stored beside it. DOCX import uses the browser's built-in ZIP decompression. To update PDF.js, update the npm dependency, copy its browser distribution and license into `src/vendor/`, then rerun the automated and manual checks.
