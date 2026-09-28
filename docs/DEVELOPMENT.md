# Development

The project has no build step. Load the repository directory directly as an unpacked Chrome extension.

For contribution expectations and the safety invariants that every change must preserve, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Development loop

1. Edit files in `src/` or `manifest.json`.
2. Run `npm test` and `npm run check`.
3. Open `chrome://extensions` and reload **On Your Behalf**.
4. Reopen the popup and confirm its version and source-bundle fingerprint footer. The fingerprint changes when packaged runtime files change, without requiring a development version bump. The scanner revision replaces older injected OYB code on an already-open page; refreshing the target page remains a useful clean-state check.
5. Serve this repository over HTTP and open `test/manual-form.html`, `test/conditional-form.html`, `test/employment-history-form.html`, or `test/long-form.html` in Chrome. Extension content scripts cannot run on `file://` pages unless the user separately enables file access.
6. Exercise the popup action and inspect the extension service worker for provider or messaging errors.

Background fills use a bounded keep-alive only while an operation is active, following Chrome's [service-worker migration guidance](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers#keep-sw-alive). Provider calls stop after 25 seconds so OYB can save a resumable checkpoint before Chrome's 30-second fetch-response limit.

For example:

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765/test/manual-form.html`.

The production fill loop can also be tested without Chrome or an unpacked extension. `npm test` runs it against an in-memory dynamic employment fixture. For the opt-in private provider comparison, run `npm run test:employment:live` with `OPENAI_VALERIA_API_KEY` available; it sends a bounded excerpt of `roman-only/linkedin-profile.md` to OpenAI and checks the exact resulting rows without printing the credential.

The CLI preview runs with `node bin/oyb.js --help`. Extension Settings exports saved profile and supporting text as a ZIP; `oyb import-profile` validates it with Python's standard library and atomically replaces a private application-data copy. The read-only `inspect` command lists existing AcroForm fields through Python `pypdf` without loading a profile or provider key. The `preview-answers` and `fill` commands use the imported profile by default, including enabled supporting documents; `--profile` uses only the named text file for one run. The `fill` command accepts a prepared AcroForm PDF and an exact-hash reviewed map of approved text fields, uses the shared answer engine, and writes a new PDF through Python `pypdf`. Install `pypdf` in the Python environment used by `python3`, or set `OYB_PYTHON` to a Python executable that has it. The writer checks stored values and widget appearances; render and inspect the output as a separate visual check. CLI keys come from provider-specific environment variables and are not read from Chrome storage. `bin/` and the Python scripts are excluded from the extension ZIP.

For a browser-only failure, use **Copy last run** in the popup's Run diagnostics section. The newest ten traces stay in extension-local storage and include run settings, compact field/group snapshots, AI suggestions, applied or failed field IDs, row actions, and the stopping reason. They exclude API keys and full profile or supporting-document contents, but may contain form answers; clear the history when it is no longer needed.

Repeated-section tests deliberately include non-contiguous raw control indexes and browser-like checkbox rescans. Application-generated numeric suffixes are treated as stable identity only; record positions follow visual row order.

## Manual smoke checks

Test at least:

- A page containing text inputs and textareas.
- An unlabeled textarea whose visible question appears only in a nearby container, as in `test/expert-screening-form.html`.
- A radio group whose individual option labels are not mistaken for the surrounding question.
- A native select whose option list is not included in its extracted field label.
- Native selects, radio groups, and checkboxes.
- A styled checkbox whose real input is hidden but whose associated label remains visible.
- Opening the popup lists populated semantic or visually marked form sections without contacting the AI provider.
- Selecting a section limits every conditional fill round to that section while Entire page preserves the original behavior.
- Replacement mode includes existing values only within the selected scope and updates each field once.
- Repeated rows remain coherent across employer/title/date-style fields, existing blank rows are used first, and a recognized in-scope Add another control creates at most one row per round when the model requests it.
- Add another controls remain detectable when a zero-size link or button wrapper contains visibly rendered children.
- Closing the popup or switching tabs does not cancel a fill; reopening on the target page restores active, paused, or completed status.
- A paused fill resumes from its saved checkpoint without regenerating completed fields or requiring additional configuration.
- `test/long-form.html` fills in section-aware batches, keeps each repeated project entry together, and may use more AI calls than a short form without exceeding its adaptive allowance.
- A stalled pass stops promptly, while reaching an AI-call, DOM-pass, provider-request, or overall-time limit preserves the remaining work for continuation.
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
- Adding several supporting files keeps them separate from the editable profile, and enable, disable, and remove changes do not become permanent until settings are saved.
- The popup accurately reports the number of enabled supporting files and can exclude them from a fill request.
- Affirmative-choice and assumption settings persist, reach the prompt, and keep consequential assumptions behind the nested opt-in.
- Supported and chosen answers receive the standard outline; inferred answers receive an amber outline.
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

Keep manifest.json unchanged during development and accumulate changes under the current unpublished version’s numbered `VERSION — Unreleased` heading. After publishing that version, start a new numbered draft section for the intended next release without changing the manifest yet; leave the published section intact. Align the manifest with the draft version only when Roman requests that release. When Roman requests a release, choose a new version only if the current version has already been published on GitHub or uploaded to the Web Store. Keep published/uploaded version history intact. Complete automated checks and the relevant manual Chrome smoke checks before release. The real release flow dates the heading; routine development and documentation changes do not trigger version bumps.

## Vendored import libraries

PDF file import uses a browser-ready copy of PDF.js under `src/vendor/`; its license is stored beside it. DOCX import uses the browser's built-in ZIP decompression. To update PDF.js, update the npm dependency, copy its browser distribution and license into `src/vendor/`, then rerun the automated and manual checks.

## Packaging and releases

Release tooling requires Node.js 22.21 or newer (Node 24 is recommended); the extension runtime and pure tests retain their existing requirements. Run `npm ci` to install pinned release dependencies. `npm run package` creates `dist/on-your-behalf-VERSION.zip` and its SHA256 sidecar from manifest.json, runtime src files, vendored license, and the four extension icons. It rejects symlinks and unexpected runtime files, checks ZIP integrity and every archived file against its source, and excludes private profiles, tests, source artwork, and development files. CI checks packaging too.

OYB uses release-it with a read-only bumper plugin: manifest.json remains the sole version source. Prepare the manifest version and matching newest `VERSION — Unreleased` changelog section before release. The release command retains that version and dates the heading in UTC after tests and packaging; it also accepts a matching dated heading for recovery. It does not automatically bump the manifest. Packaging/release-maintenance changes alone do not require a version bump.

After manual Chrome smoke checks of the extracted ZIP, commit all intended changes on main, then run:

```bash
npm run release -- --dry-run
npm run release
```

The wrapper's dry run is offline and does not modify files, fetch credentials, run tests, or contact GitHub. It previews the current release and reports pending changes; it is not proof that remote permissions or tags are valid. The actual command requires clean main and the expected origin, obtains a token from the existing gh login if GITHUB_TOKEN is not provided, and runs release-it noninteractively. Tests, syntax checks, and verified packaging run before release, followed by dating the newest changelog heading; release-it handles commit, tag, push, GitHub notes from the newest changelog section, and ZIP/checksum assets. No token is written to disk or printed. Web Store upload and review remain manual; see docs/STORE-LISTING.md.

### Interrupted release recovery

Do not blindly rerun after a failure: publication is not atomic across Git and GitHub. Inspect `git status`, the local/remote tag, `gh release view vVERSION --repo rsheyd/on-your-behalf`, and its assets first. The wrapper refuses an existing local version tag so it cannot silently publish a different checkout under that version. If nothing was tagged or published, resolve the failure, inspect any dated changelog change left locally, commit intended metadata changes if needed to restore a clean checkout, and rerun. A matching dated heading is accepted. If the correct tag was pushed but the release or assets are missing, recover using gh against that verified tag, with notes from `node scripts/release-notes.js` written to a temporary file and the exact previously verified ZIP/checksum. Compare the checksum to the uploaded artifact before declaring recovery complete. Do not delete or move a published tag to repair a release. A different artifact needs a new version. This recovery path remains manual and has not been live-published during setup.

The September 2026 development entries 0.6.1 through 0.6.5 were consolidated into 0.6.0 — Unreleased before any of those versions were published or uploaded. Historical 0.4.0 and earlier entries were retained. Previously built development ZIPs are not release records; submit only the current version’s verified package.
