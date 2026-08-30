# Conditional Form Support

## Goal

Update On Your Behalf (OYB) to fill forms whose visible fields change in response to earlier answers. The New York unemployment Work Search Activity Record form is the reference case, but the implementation must remain generic and must not depend on that site's labels, markup, or styling.

OYB must continue to require user review and must never submit a form or click a navigation or progression control.

## Reference behavior

The captured NY form initially displays:

- Date.
- Activity Type.
- Activity Description.

After `Activity Type` is set to `Employer Contact`, it additionally displays:

- Method of Contact.
- Position Applied For.
- Result of Contact.
- Notes.

Live inspection was completed in a separate Chrome work profile after the form failed to load reliably in the usual profile. The form uses PrimeFaces custom comboboxes backed by hidden native selects. Each Activity Type or Activity Description change sends an authenticated AJAX request and replaces the full activity-controls subtree. The Date input is outside that replaced subtree. Closed combobox panels contain no option elements; their visible option elements are created only when a menu opens.

Activity Type has two non-placeholder options:

- `Employer Contact` provides Inquiry, state-posting response, internet-posting response, submitted application, sent resume, interview, staffing-agency registration, and other-employer descriptions. It reveals Method of Contact, Position Applied For, Result of Contact, Notes, and Business / Organization. Choosing Other employer contact also inserts a required Other Activity Notes textarea.
- `Work Search Preparation Activity` provides company or industry research, career exploration, workshop, Department of Labor appointment, LinkedIn networking, other social networking, job coaching, resume work, Job Bank or Job Scout registration, head-hunter or outplacement work, and other-preparation descriptions. It reveals Notes. Choosing Other preparation activity also inserts a required Other Activity Notes textarea.

All ordinary descriptions within a type retain the same field shape. Switching from Employer Contact to Work Search Preparation Activity removes the employer-specific controls. Because the subtree is replaced, surviving logical controls receive new DOM elements even when their generated IDs remain textually identical.

## Offline testing approach

Use the live NY form only as a behavioral reference. A browser's “Save Page As” output can be useful as temporary evidence, but it should not become the committed test fixture because an authenticated government form may depend on session state, server responses, remote scripts, and AJAX requests that do not work offline. A saved page may also retain personal or session data.

Do not commit saved page bundles, HAR files, cookies, account identifiers, entered work-search records, or other authenticated material. Capture screenshots and sanitized DOM snippets only when needed, and remove personal information before retaining them.

The NY form may not load reliably in the user's usual Chrome profile and is often accessed through Safari instead. For live observation, use whichever already authenticated browser can load the form without changing account or security settings. If Chrome has the problem, try another available Chrome profile before concluding that the site behavior cannot be inspected there. Record which browser and profile context was used because profile-specific extensions, cached state, or browser compatibility may affect the observed behavior. Safari may be used for behavioral reference, but final OYB validation still requires a Chrome profile in which both the extension and form work.

The repository-owned `test/conditional-form.html` fixture reproduces the relevant behavior without copying the site's application code or presentation. The fixture includes:

- A text date field with a JavaScript date picker.
- A parent Activity Type select that reveals dependent controls.
- An Activity Description select that can reveal another dependency level.
- Both immediate and slightly delayed DOM updates.
- A branch in which previously visible child fields disappear after a parent answer changes.
- PrimeFaces-like visible custom comboboxes backed by hidden native selects.
- Menus whose option elements exist only while the custom menu is open.
- A complete dependent-subtree replacement after a short asynchronous delay.
- A submit control with instrumentation that confirms OYB never activates it.

## Proposed fill workflow

Replace the current one-time scan and fill with a bounded multi-pass workflow:

1. Scan the currently visible, enabled, non-sensitive fields.
2. Generate suggestions only for newly discovered or meaningfully changed, still-empty fields that have not already been resolved.
3. Fill accepted suggestions in document order and dispatch the events expected by the page.
4. After filling a select, radio, checkbox, or custom combobox, observe briefly for structural changes or changed option lists.
5. If a meaningful change occurs, stop applying potentially stale downstream suggestions, wait for the page to settle, and rescan.
6. Repeat until no new or changed eligible fields appear, no progress is possible, the overall time limit is reached, or the configured round limit is reached.

The workflow must detect changed existing controls as well as newly visible controls. For example, Activity Description may remain visible while its option list changes after Activity Type is selected; any Activity Description suggestion based on the old options must be discarded and regenerated.

Live PrimeFaces validation showed that authenticated AJAX replacements can begin well after a short quiet period. Custom combobox fills therefore require a minimum observation window in addition to mutation-based quiet detection; otherwise OYB may rescan the old subtree and stop until the user starts another fill action.

Begin fixture testing with a strict limit of six rounds plus an overall time limit, then select the final values from observed behavior. The workflow should avoid unnecessary provider requests when a round reveals no new or changed fields and may safely retain suggestions only for controls whose relevant metadata and option lists remain unchanged.

## Form-specific context controls

Conditional forms often describe a particular event or transaction whose facts do not belong in the user's durable profile. Before running the multi-pass workflow, the popup should let the user choose the information OYB may use:

- Add a **Context for this form** control that reveals a text area for pasted notes, AI-generated answers, or a single structured activity record.
- Add an **Include saved profile** toggle so the user can omit the durable profile when it is irrelevant to the form.
- Keep form-specific context ephemeral by default rather than adding it to the saved profile automatically. Offer opt-in session retention that restores the context when the popup reopens, stores it only in `chrome.storage.session`, and provides an immediate clear action.
- Treat pasted context as user-provided facts and keep it logically separate from page content, which remains untrusted.
- Clearly disclose that enabled context sources and scanned field metadata are sent to the configured AI provider when the user starts filling.

The initial implementation may accept freeform text. For forms that record one item at a time, guidance should encourage the user to provide one event or activity per fill action. Structured submission-packet import is a possible later extension, not a requirement for conditional-form support.

## Field identity and state

OYB currently removes and recreates its field identifiers on every scan. Conditional-form support should preserve identifiers on elements that survive a rescan and assign identifiers only to newly discovered elements.

Track enough state across passes to prevent repeated provider requests and accidental overwrites:

- Fields already filled by OYB.
- Fields already classified as unresolved.
- Fields skipped because they are sensitive, disabled, hidden, or read-only.
- Suggestions whose target element disappeared before filling.
- Suggestions invalidated because the target's option list or relevant metadata changed.
- The visible-field signature or equivalent progress marker for loop detection.

Do not overwrite non-empty values entered by the user. If selecting a parent removes a child field, discard any pending suggestion for that child. Do not change a parent answer merely to expose additional branches.

## Provider and progress behavior

Each provider request should contain only the fields relevant to that pass while retaining the page context needed for accurate answers. Aggregate unresolved results across passes, remove stale entries for controls that disappear, and show the final unresolved list only after the workflow stops.

Update popup status text so the user can see that OYB is checking for additional questions rather than appearing stuck. Final reporting should distinguish successfully filled fields, unresolved questions, technical matching failures, and reaching the safety pass limit.

## Testing

Keep orchestration decisions that can be separated from Chrome APIs in pure modules with Node tests. Add automated coverage for:

- Detecting fields that are new between scans.
- Preserving stable field identity.
- Avoiding repeat suggestions for filled or resolved fields.
- Aggregating and removing unresolved entries as fields appear and disappear.
- Stopping when there is no progress.
- Enforcing the maximum pass count.
- Discarding suggestions for removed controls.
- Never treating submit or navigation controls as fill targets.

Manually verify every branch of the offline fixture in Chrome. Confirm that the correct browser events reveal dependent controls, user-entered values are preserved, hidden fields are not filled, and the fixture's submit instrumentation remains untouched.

After the fixture passes, perform a final smoke test on the live NY form without submitting or advancing it.

## Implementation phases

### Phase 1: Offline reference fixture

Status: completed on August 29, 2026.

Inventory the remaining branches of the live NY form using screenshots and sanitized field metadata. Capture the options available under each Activity Type, the Activity Description options under each type, the fields each combination reveals, whether controls are hidden or recreated, the timing of updates, and the browser/profile context used for observation.

Build `test/conditional-form.html` with one realistic two-level path and at least one alternate branch that removes previously visible fields. Include an immediate menu update, a delayed subtree replacement, changed options on an existing logical control, and submit instrumentation.

Completion gate: satisfied. Local browser verification covered both activity types, the extra Other Activity Notes field, delayed subtree replacement, employer-field removal after switching types, and zero submit or navigation attempts. The fixture contains no authenticated code, session data, or personal information.

### Phase 2: Pure state logic and stable scanning

Status: completed on August 29, 2026.

Preserve identifiers on DOM elements that survive rescanning. Extract pure helpers that compare consecutive scans and classify fields as new, changed, unchanged, disappeared, filled, or resolved.

Add Node tests for stable identity, option-list changes, stale-suggestion invalidation, unresolved aggregation, progress detection, and round-limit enforcement.

Completion gate: satisfied. Node tests prove logical-key generation, stable ID reuse across replacement elements, option-sensitive fingerprints, four-way scan comparison, pending-field selection, unresolved reconciliation, stale-suggestion rejection, and bounded round decisions without requiring Chrome.

### Phase 3: Mutation-aware orchestration

Status: completed on August 29, 2026.

Implement bounded scan, generate, fill, observe, and rescan rounds in the content and popup flows. Stop applying downstream suggestions after a choice control produces a meaningful mutation, preserve user-entered values, discard stale suggestions, and enforce both round and overall time limits.

Add the **Context for this form** control and **Include saved profile** toggle to the popup. Pass only the enabled context sources into each provider request, support optional browser-session retention for repeated fills, and do not merge form context into the saved profile.

Update progress and final reporting to explain additional-question checks, successful fills, unresolved questions, technical failures, and safety-limit termination.

Completion gate: satisfied. One popup action with synthetic form-specific context and the saved profile disabled filled Date, Employer Contact, Other employer contact, Other Activity Notes, Email, Position Applied For, Waiting for a response, and Notes through two asynchronous dependency levels. The fixture recorded three dependent-subtree renders, two selection changes, zero submit attempts, and zero navigation attempts. Business / Organization remained empty because it was absent from the supplied context, confirming that the provider did not invent the missing fact. Automated pending-field coverage confirms that existing non-empty values are excluded from fill rounds.

### Phase 4: Live validation and release

Status: completed on August 29, 2026.

Run syntax checks, Node tests, and every branch of the manual fixture matrix. Perform a non-submitting smoke test on the live NY form and record any site behavior the fixture did not cover.

Update documentation and current limitations, bump `manifest.json` to `0.4.0`, and record conditional-form support under `0.4.0` in `CHANGELOG.md`.

Completion gate: satisfied. Offline validation covered both activity branches, changed option lists, extra Other fields, disappearing employer controls, delayed subtree replacement, and zero submit or navigation attempts. Live NY validation exposed and then verified fixes for site-wide Search leakage, hidden-value versus visible-label option matching, nested PrimeFaces menu triggers, and delayed authenticated AJAX replacement. The Employer Contact path reached its final visible fields for review without Save, Save & Next, submission, or navigation.

## Acceptance criteria

- OYB fills a parent choice and subsequently discovers and fills the dependent fields revealed by that choice.
- OYB detects when an existing field's available options change and does not apply a suggestion generated from its earlier options.
- OYB supports at least two dependency levels in the offline fixture.
- The user can provide temporary form-specific context and exclude the saved profile from a fill request.
- Temporary context is not silently added to the durable profile.
- The process terminates predictably and does not make repeated requests for unchanged fields.
- Existing user-entered values are not overwritten.
- Suggestions for disappeared fields are ignored safely.
- Sensitive fields remain individually excluded.
- OYB never submits the form or activates navigation or progression controls.
- Automated tests and the offline manual fixture pass.
- The live NY form can be filled through its conditional fields for user review without submission.
