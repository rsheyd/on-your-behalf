# Durable Repeated-Section Filling

## Goal

Make repeated sections such as employment history reliable when OYB replaces existing records, reveals dependent controls, adds rows, takes longer than one minute, or loses its popup because the user changes tabs.

The implementation should remain general enough for education, addresses, dependents, and references. It should not contain Guidepoint-specific selectors or encode employment records in the application.

## Problems to solve

### Replacement loses record assignments

OYB currently combines replacement and row creation in one multi-round loop. Changing a control such as `Currently Employed` can reveal end-date fields and cause a rescan. A later AI request can then assign the source records again from the beginning, leaving original rows unchanged while adding duplicate records at the end.

### Work exceeds the timeout

Repeated rescans and AI calls can consume the current 60-second allowance before a long section is complete. The timeout is reached even while useful progress is being made.

### The popup owns the operation

Chrome destroys a toolbar popup when it loses focus. Because the popup currently runs the fill loop, closing it or moving to another tab cancels the operation instead of merely hiding its status.

## Design principles

- Treat replacement of the initially visible rows as a distinct phase that finishes before row creation begins.
- Preserve the association between a row ordinal and its selected source record throughout a fill action.
- Reuse generated suggestions after a dependent-control mutation whenever their stable field identities remain valid.
- Ask the AI again only for newly revealed or newly created fields, not to re-plan records already assigned.
- Keep orchestration independent of the popup lifecycle and retain the existing prohibition on submission, saving, progression, and navigation.
- Prefer small state and pure helpers over a Guidepoint-specific workflow engine.

## Phases

### Phase 1: Reproduction fixture and diagnostic assertions

Extend `test/employment-history-form.html` to mirror the relevant behavior of the observed form:

- Start with four populated but intentionally incorrect employment rows.
- Use indexed employer, title, current-employment, start-month, start-year, end-month, and end-year controls.
- Disable and clear end-date controls when a row becomes current; reveal them when it becomes non-current.
- Provide a safe `Add Another Company` action that appends one blank row.
- Display a machine-readable fixture state containing every row, the add-row count, and any submit or navigation attempts.
- Add configurable response delays so a fill can safely cross the former 60-second boundary.

Add pure tests for record assignments, queued-suggestion reconciliation, replacement-phase completion, and operation-state transitions. Keep all committed fixture data synthetic; private live comparisons may use `roman-only/linkedin-profile.md`.

Completion gate: the fixture reproduces all three reported failures on the pre-fix implementation, without contacting or navigating the real Guidepoint form.

### Phase 2: Transactional replacement of existing rows

At the beginning of a replacement run, capture the stable identifiers and ordinals of every repeated row already in the selected scope. Treat those rows as the replacement set.

Generate assignments for that set once. When a checkbox or select changes the DOM:

- Retain suggestions whose stable identities are still valid.
- Fill the newly revealed controls for the same row and source record.
- Do not restart source ordering for later rows.
- Do not expose an add-row action to the model until every original row is filled or explicitly unresolved.

Avoid creating a separate employment data model. The transaction should operate on the existing collection, entry, role, and stable-field metadata.

Completion gate: with four incorrect existing rows, replacement writes the first four source records into rows 1–4 in source order and creates no new row during that phase.

### Phase 3: Controlled row expansion

After the replacement set is complete, compare populated records with the enabled source material and allow one in-scope add-row action when another useful record remains. Fill the new row before considering another addition.

The existing round bound remains the runaway protection. OYB must never remove a row automatically and must never activate submit, save, continue, next, or other navigation controls.

Completion gate: additional records begin at row 5, no existing source record is duplicated, and the fixture reports exactly the number of add-row activations needed for the records filled.

### Phase 4: Longer progress-based runtime

Replace the fixed one-minute cutoff with a three-minute ceiling while retaining the six-round limit. Track recent progress so a stalled operation ends promptly rather than consuming the full allowance.

Reducing redundant AI calls is the primary performance improvement; the longer ceiling is a fallback for legitimately slow providers and dynamic forms.

Completion gate: a fixture run with artificial delays exceeding 60 seconds completes successfully, while a no-progress run stops without waiting three minutes.

### Phase 5: Background-owned fill operation

Move the multi-round orchestration and operation state from `src/popup.js` into the extension service worker. At startup, capture the target tab ID, selected section, replacement choice, form context, profile/source toggles, and answering settings.

The background operation should:

- Continue addressing the captured target tab even if another tab becomes active.
- Persist compact progress and final results in session storage.
- Permit a reopened popup to render the current or completed operation.
- Prevent a second fill from starting for the same tab while one is active.
- Report clearly if the target tab closes, navigates, or becomes unavailable.

The popup becomes a command and status view. Closing it must not cancel work. No automatic submission or navigation is introduced.

Completion gate: start a delayed fixture fill, close the popup, switch to another tab, reopen the popup, and observe that the original fixture continued and its final result remains visible.

### Phase 6: End-to-end verification and documentation

Run the completed implementation against the local fixture using a sanitized source first, then perform a private live-provider comparison using `roman-only/linkedin-profile.md` and the configured OpenAI credential without logging the credential or committing personal data.

Verify the final fixture state rather than relying only on green outlines or popup counts. Update development smoke checks, the changelog, and the popup build marker under the existing `0.6.0` development release unless the release version has changed before implementation begins.

Completion gate: automated tests, syntax checks, `git diff --check`, and every acceptance scenario below pass.

## Required fixture scenarios

1. **Replace four existing rows:** Four incorrect rows become the first four source records in order; no fifth row is created until all four are complete.
2. **Reveal past-job end dates:** Changing an incorrectly current row to non-current reveals and fills its correct end month and year without reassigning another row.
3. **Preserve a current job:** The current row remains checked and its end-date controls remain blank and disabled.
4. **Add remaining records:** New rows contain only source records not already represented in the original rows.
5. **Slow successful run:** Artificial delays push elapsed time beyond 60 seconds but below three minutes, and the operation completes.
6. **Popup closure and tab switch:** Closing the popup and activating another tab do not interrupt the captured target-tab operation.
7. **Reopen status:** Reopening the popup shows current progress or the final result from session storage.
8. **Safety invariants:** Fixture counters confirm zero submit, save, continue, and navigation attempts.

## Acceptance criteria

- Replacement mode updates the initially existing repeated rows before adding any row.
- Each source record stays bound to one row across rescans and dependent-field changes.
- Existing records are not duplicated at the end of the section.
- End dates are filled for non-current jobs and remain empty for current jobs.
- A productive operation may run for up to three minutes but remains bounded to six rounds.
- Popup closure and tab switching do not cancel an active fill.
- A reopened popup accurately displays active or completed status.
- The implementation remains provider-neutral and reusable for repeated sections beyond employment history.
- OYB never submits the form or activates navigation or progression controls.

## Implementation order

Implement Phases 1 and 2 together and prove replacement correctness before changing runtime ownership. Then add controlled row expansion, adjust the timeout, and finally move orchestration into the service worker. This order keeps behavioral defects separate from lifecycle changes and leaves a working fixture available throughout the refactor.
