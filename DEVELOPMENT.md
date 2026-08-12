# Development

The project has no build step. Load the repository directory directly as an unpacked Chrome extension.

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test` and `npm run check`.
3. Open `chrome://extensions` and reload **On Your Behalf**.
4. Serve this repository over HTTP and open `test/manual-form.html` in Chrome. Extension content scripts cannot run on `file://` pages unless the user separately enables file access.
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
- Connection testing reports invalid-key, quota or billing, unavailable-model, rate-limit, and network failures clearly.
- Clearing a saved key does not become permanent until settings are saved.
- Editing a filled value before manually submitting.
- Confirmation that submit, next, and continue buttons are never clicked.

## Versioning

The extension has a single version source: the `version` field in `manifest.json`. The private `package.json` intentionally has no version because this project is not published to npm.

Update `manifest.json`, update `CHANGELOG.md`, run automated tests, and complete the relevant manual smoke checks before creating a release.

## Vendored import libraries

PDF file import uses a browser-ready copy of PDF.js under `src/vendor/`; its license is stored beside it. DOCX import uses the browser's built-in ZIP decompression. To update PDF.js, update the npm dependency, copy its browser distribution and license into `src/vendor/`, then rerun the automated and manual checks.
