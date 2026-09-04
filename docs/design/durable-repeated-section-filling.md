# Durable Repeated-Section Filling

## Goal

Make repeated sections such as employment history reliable when OYB replaces existing records, reveals dependent controls, adds rows, processes a long form in batches, reaches an operational limit, or loses its popup because the user changes tabs.

The implementation should remain general enough for education, addresses, dependents, and references. It should not contain Guidepoint-specific selectors or encode employment records in the application.

## Problems to solve

### Replacement loses record assignments

OYB currently combines replacement and row creation in one multi-round loop. Changing a control such as `Currently Employed` can reveal end-date fields and cause a rescan. A later AI request can then assign the source records again from the beginning, leaving original rows unchanged while adding duplicate records at the end.

### Long forms exceed fixed limits

Repeated rescans and AI calls can consume the current 60-second allowance before a long section is complete. A larger fixed timeout alone would only give an inefficient or stalled loop more time, while a universal AI-round limit does not scale naturally from a short questionnaire to a long multi-section form.

### The popup owns the operation

Chrome destroys a toolbar popup when it loses focus. Because the popup currently runs the fill loop, closing it or moving to another tab cancels the operation instead of merely hiding its status.

## Design principles

- Treat replacement of the initially visible rows as a distinct phase that finishes before row creation begins.
- Preserve the association between a row ordinal and its selected source record throughout a fill action.
- Reuse generated suggestions after a dependent-control mutation whenever their stable field identities remain valid.
- Ask the AI again only for newly revealed or newly created fields, not to re-plan records already assigned.
- Keep orchestration independent of the popup lifecycle and retain the existing prohibition on submission, saving, progression, and navigation.
- Process long forms in coherent section or repeated-group batches and checkpoint completed work automatically.
- Treat zero-progress detection as the normal stopping mechanism and wall-clock limits as emergency guardrails.
- Prefer small state and pure helpers over a Guidepoint-specific workflow engine.

## Phases

### Phase 1: Reproduction fixture and diagnostic assertions

Status: Complete. The fixture and pure diagnostic contracts are covered by automated tests; production fill behavior is unchanged by this phase.

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

Status: Implemented. The local fixture contract, transactional state sequence, and a live four-row provider assignment are verified; the final toolbar-popup smoke test remains part of release validation.

At the beginning of a replacement run, capture the stable identifiers and ordinals of every repeated row already in the selected scope. Treat those rows as the replacement set.

Generate assignments for that set once. When a checkbox or select changes the DOM:

- Retain suggestions whose stable identities are still valid.
- Fill the newly revealed controls for the same row and source record.
- Do not restart source ordering for later rows.
- Do not expose an add-row action to the model until every original row is filled or explicitly unresolved.

Avoid creating a separate employment data model. The transaction should operate on the existing collection, entry, role, and stable-field metadata.

Completion gate: with four incorrect existing rows, replacement writes the first four source records into rows 1–4 in source order and creates no new row during that phase.

### Phase 3: Controlled row expansion

Status: Implemented. Add-row decisions are explicit even with no ordinary fields pending, and each newly added entry must settle before another action becomes available. Live provider checks requested one fifth row and filled it with an unrepresented source record.

After the replacement set is complete, compare populated records with the enabled source material and allow one in-scope add-row action when another useful record remains. Fill the new row before considering another addition.

The existing round bound remains the runaway protection. OYB must never remove a row automatically and must never activate submit, save, continue, next, or other navigation controls.

Completion gate: additional records begin at row 5, no existing source record is duplicated, and the fixture reports exactly the number of add-row activations needed for the records filled.

### Phase 4: Background-owned operation and automatic checkpoints

Status: Implemented. The service worker owns the fill loop, checkpoints after meaningful stages, and exposes active, paused, completed, and failed status to a reopened popup. Pure resume reconciliation is covered by automated tests; the unpacked-extension popup-close and tab-switch smoke scenario remains for release validation.

Move the multi-round orchestration and operation state from `src/popup.js` into the extension service worker. At startup, capture the target tab ID, selected section, replacement choice, form context, profile/source toggles, and answering settings.

Persist a compact checkpoint containing the target page and scope, completed stable fields and repeated records, remaining batches, queued suggestions that have not yet been applied, operation settings, progress, and the final stopping reason. Reconcile that checkpoint with a fresh page scan before resuming so user edits are preserved unless replacement remains enabled and stale field identities are not applied blindly.

The background operation should:

- Continue addressing the captured target tab even if another tab becomes active.
- Permit a reopened popup to render the current, paused, or completed operation.
- Offer a simple `Continue filling` action after an operational limit without requiring advanced configuration.
- Prevent a second fill from starting for the same tab while one is active.
- Report clearly if the target tab closes, navigates, or changes too substantially to resume safely.

The popup becomes a command and status view. Closing it must not cancel work. No automatic submission or navigation is introduced.

Completion gate: start a delayed fixture fill, close the popup, switch to another tab, reopen the popup, and observe that the original fixture continued. Stop a partially completed operation at a test limit, reopen OYB, continue it, and confirm that completed fields are not regenerated or overwritten.

### Phase 5: Adaptive batching and progress-based limits

Status: Implemented. Pending fields are divided into section-aware batches of up to 25 fields without splitting repeated entries. AI calls scale with the initial batch count plus two follow-ups and gain only the calls needed to evaluate and fill each successfully added repeated row. DOM work has a separate 20-pass bound, provider calls time out individually, and zero-progress detection or the five-minute emergency ceiling preserves a resumable checkpoint. Pure batching, limit decisions, and the production orchestration loop are covered by automated tests.

Scan the selected scope once and divide large forms into coherent batches, preferring page sections and complete repeated groups over arbitrary field boundaries. A first implementation may cap ordinary batches at approximately 20–30 fields while keeping each repeated record together.

Separate expensive AI requests from inexpensive DOM passes. Generate a complete desired repeated-record set when practical, reuse queued suggestions after mutations, and allow DOM rescans and row additions without counting each one as another AI round.

Use limits that scale with the work:

- Set the AI-call allowance to the number of initial batches plus up to two follow-up calls for genuinely new or unresolved fields, then extend it only when a repeated row is actually added and needs an answer-and-decision cycle.
- Give each provider request its own timeout so one stalled request cannot consume the entire operation.
- Allow a bounded number of DOM passes, initially around 20, while stopping immediately when a pass fills no field, changes no control, reveals no field, and adds no row.
- Retain a generous overall ceiling, initially five minutes for a large form, only as a final runaway guardrail.
- Preserve the checkpoint and remaining batches whenever any limit is reached so the next action resumes instead of restarting.

Completion gate: a short form normally completes in one to three AI calls; a long fixture is processed section by section with an adaptive call allowance; an artificial delay beyond 60 seconds can complete; a no-progress run stops promptly; and a deliberately limited run resumes from its first unfinished batch.

### Phase 6: End-to-end verification and documentation

Status: Implemented. The production orchestration loop now runs behind a small adapter boundary shared by Chrome and headless tests. The offline integration test verifies four-row replacement, dependent end-date revelation, current-row preservation, bounded expansion, and exact final state. The opt-in private OpenAI check passed against a bounded excerpt of `roman-only/linkedin-profile.md`, producing the expected first five employment records in five calls with one added row. Chrome remains covered by the thin messaging adapter and a bounded active-operation keep-alive; routine answer-order and expansion testing no longer requires a browser, local server, popup interaction, or unpacked-extension reload.

Run the completed implementation against the local fixture using a sanitized source first, then perform a private live-provider comparison using `roman-only/linkedin-profile.md` and the configured OpenAI credential without logging the credential or committing personal data.

Verify the final fixture state rather than relying only on green outlines or popup counts. Update development smoke checks, the changelog, and the popup build marker under the existing `0.6.0` development release unless the release version has changed before implementation begins.

Completion gate: automated tests, syntax checks, `git diff --check`, and every acceptance scenario below pass.

## Required fixture scenarios

1. **Replace four existing rows:** Four incorrect rows become the first four source records in order; no fifth row is created until all four are complete.
2. **Reveal past-job end dates:** Changing an incorrectly current row to non-current reveals and fills its correct end month and year without reassigning another row.
3. **Preserve a current job:** The current row remains checked and its end-date controls remain blank and disabled.
4. **Add remaining records:** New rows contain only source records not already represented in the original rows.
5. **Long batched form:** A multi-section fixture is processed in coherent batches without splitting a repeated record or imposing a universal three-call limit.
6. **Popup closure and tab switch:** Closing the popup and activating another tab do not interrupt the captured target-tab operation.
7. **Reopen status:** Reopening the popup shows current progress or the final result from session storage.
8. **Pause and resume:** A test limit stops a partially completed fill, `Continue filling` resumes at the first unfinished batch, and prior user edits remain intact unless replacement is still selected.
9. **Slow successful run:** Artificial delays push elapsed time beyond 60 seconds while measurable progress continues, and the operation completes within the emergency ceiling.
10. **Stalled run:** A pass with no filled fields, changed controls, revealed fields, or added rows stops promptly rather than consuming the overall ceiling.
11. **Safety invariants:** Fixture counters confirm zero submit, save, continue, and navigation attempts.

## Acceptance criteria

- Replacement mode updates the initially existing repeated rows before adding any row.
- Each source record stays bound to one row across rescans and dependent-field changes.
- Existing records are not duplicated at the end of the section.
- End dates are filled for non-current jobs and remain empty for current jobs.
- AI calls scale with coherent batches and are distinct from bounded DOM passes.
- A stalled operation stops promptly, while the overall time ceiling remains only an emergency guardrail.
- Reaching a limit preserves completed work and allows a configuration-free continuation from the remaining fields.
- Popup closure and tab switching do not cancel an active fill.
- A reopened popup accurately displays active, paused, or completed status.
- The implementation remains provider-neutral and reusable for repeated sections beyond employment history.
- OYB never submits the form or activates navigation or progression controls.

## Implementation order

Phases 1 through 3 establish replacement correctness and controlled expansion. Next move orchestration and checkpointing into the service worker so longer operations survive popup closure and can resume safely. Only then add adaptive batching and progress-based limits, because extending runtime before durable ownership would preserve the current lifecycle failure and mask inefficient loops. Finish with end-to-end verification and documentation.
