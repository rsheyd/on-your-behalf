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

Other Activity Type and Activity Description branches still need to be inventoried before implementation. The inventory should record the available options under each parent selection, which controls appear, disappear, or change, whether elements are replaced or updated in place, and whether each update is immediate or asynchronous.

## Offline testing approach

Use the live NY form only as a behavioral reference. A browser's “Save Page As” output can be useful as temporary evidence, but it should not become the committed test fixture because an authenticated government form may depend on session state, server responses, remote scripts, and AJAX requests that do not work offline. A saved page may also retain personal or session data.

Do not commit saved page bundles, HAR files, cookies, account identifiers, entered work-search records, or other authenticated material. Capture screenshots and sanitized DOM snippets only when needed, and remove personal information before retaining them.

Create a small repository-owned fixture, likely `test/conditional-form.html`, that reproduces the relevant behavior without copying the site's application code or presentation. The fixture should include:

- A text date field with a JavaScript date picker.
- A parent Activity Type select that reveals dependent controls.
- An Activity Description select that can reveal another dependency level.
- Both immediate and slightly delayed DOM updates.
- A branch in which previously visible child fields disappear after a parent answer changes.
- Native selects whose handlers respond to bubbling `input` and `change` events.
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

Begin fixture testing with a strict limit of six rounds plus an overall time limit, then select the final values from observed behavior. The workflow should avoid unnecessary provider requests when a round reveals no new or changed fields and may safely retain suggestions only for controls whose relevant metadata and option lists remain unchanged.

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

Inventory the remaining branches of the live NY form using screenshots and sanitized field metadata. Capture the options available under each Activity Type, the Activity Description options under each type, the fields each combination reveals, whether controls are hidden or recreated, and the timing of updates.

Build `test/conditional-form.html` with one realistic two-level path and at least one alternate branch that removes previously visible fields. Include an immediate update, a delayed update, changed options on an existing control, and submit instrumentation.

Completion gate: the fixture reproduces the important NY behavior when operated manually without containing authenticated code, session data, or personal information.

### Phase 2: Pure state logic and stable scanning

Preserve identifiers on DOM elements that survive rescanning. Extract pure helpers that compare consecutive scans and classify fields as new, changed, unchanged, disappeared, filled, or resolved.

Add Node tests for stable identity, option-list changes, stale-suggestion invalidation, unresolved aggregation, progress detection, and round-limit enforcement.

Completion gate: scan comparison and multi-round state transitions are proven by Node tests without requiring Chrome.

### Phase 3: Mutation-aware orchestration

Implement bounded scan, generate, fill, observe, and rescan rounds in the content and popup flows. Stop applying downstream suggestions after a choice control produces a meaningful mutation, preserve user-entered values, discard stale suggestions, and enforce both round and overall time limits.

Update progress and final reporting to explain additional-question checks, successful fills, unresolved questions, technical failures, and safety-limit termination.

Completion gate: one popup action fills the fixture through two dependency levels without overwriting user-entered values or activating submit.

### Phase 4: Live validation and release

Run syntax checks, Node tests, and every branch of the manual fixture matrix. Perform a non-submitting smoke test on the live NY form and record any site behavior the fixture did not cover.

Update documentation and current limitations, bump `manifest.json` to `0.4.0`, and record conditional-form support under `0.4.0` in `CHANGELOG.md`.

Completion gate: the NY Employer Contact path reaches its final visible fields for user review without submission or navigation.

## Acceptance criteria

- OYB fills a parent choice and subsequently discovers and fills the dependent fields revealed by that choice.
- OYB detects when an existing field's available options change and does not apply a suggestion generated from its earlier options.
- OYB supports at least two dependency levels in the offline fixture.
- The process terminates predictably and does not make repeated requests for unchanged fields.
- Existing user-entered values are not overwritten.
- Suggestions for disappeared fields are ignored safely.
- Sensitive fields remain individually excluded.
- OYB never submits the form or activates navigation or progression controls.
- Automated tests and the offline manual fixture pass.
- The live NY form can be filled through its conditional fields for user review without submission.
