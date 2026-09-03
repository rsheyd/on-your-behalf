# Personal Knowledge and Evidence

## Purpose

Evolve OYB from profile-powered autofill into an evidence-aware personal knowledge system. Suggested answers should distinguish what the user explicitly provided, what the user previously reviewed, what the model inferred, and what outside research says.

The design may make OYB a heavier product, but it must preserve its defining controls: local-first storage, no OYB backend or account, bring-your-own-provider access, deterministic sensitive-field exclusion, visible review, and no submission or navigation actions.

## Product model

The target flow is:

`profile + approved answers + current context + optional research -> answer with provenance -> user review`

OYB should maintain four conceptually separate sources:

1. **Profile** — durable user-provided facts, experience, and writing preferences.
2. **Supporting files** — user-selected reference documents retained separately from the editable profile.
3. **Answer library** — final answers the user explicitly reviewed and chose to save.
4. **Current form context** — temporary facts for the present form or activity.
5. **Outside knowledge** — model knowledge or optional web research used to interpret a question, never as evidence of personal experience.

The editable profile is the authoritative durable source. Supporting files may supply additional evidence, but their content is reference data rather than instructions, and the profile takes precedence when sources conflict.

## Evidence states

Each generated answer should carry a small, meaningful evidence classification rather than a numerical confidence score:

- `direct` — explicitly supported by the profile or current form context.
- `approved_answer` — supported by a previously reviewed answer.
- `adjacent` — a disclosed inference from related experience, without direct evidence of the requested claim.
- `general_knowledge` — outside knowledge helps interpret the question but provides no personal evidence.
- `insufficient` — the available personal sources do not safely support an answer.
- `user_judgment` — the field requires consent, preference, attestation, or another current decision.

The model may use general knowledge and research to understand terminology. It must never convert either into a claim that the user used, purchased, priced, sold, operated, or otherwise directly experienced something.

The response schema should include the proposed value, evidence state, supporting source identifiers or excerpts, a concise warning when appropriate, and the existing unresolved classification when the field should remain empty. Pure prompt construction and response validation must remain independent from Chrome APIs and covered by Node tests.

## Review experience

The planned side-panel workspace is the natural home for evidence review. For each field it should show:

- The generated answer and current field value.
- A plain-language evidence label.
- A **Why?** control revealing the supporting profile, context, or approved-answer excerpts.
- Any gap or inference warning.
- An explicit action to save the final reviewed value for future use.

Suggested visual states are green for direct or approved support, yellow for adjacent inference, and unfilled for insufficient evidence or user judgment. Red should be reserved for technical or validation errors rather than weak evidence.

OYB must not consider an answer approved merely because it inserted the answer into a field. Saving it for reuse requires an explicit user action after review. Where practical, the saved value should reflect the field's current value so user edits are retained.

## Answer library

An answer-library record should contain:

- A stable local identifier.
- The original question or normalized question text.
- The final user-approved answer.
- User-editable topics or tags.
- The date saved and, where relevant, a `valid as of` date.
- The originating site or form category when useful and approved for storage.
- The evidence class and references to supporting profile items or excerpts.

Previous answers should remain contextual records, not automatically become timeless profile facts. Time-sensitive claims such as current employment should be identifiable as potentially stale.

All records should remain inspectable, editable, deletable, and exportable by the user. Raw form pages should not be retained.

## Profile representation

Keep the primary profile readable and portable instead of replacing it with a large JSON-only editor. Markdown or similarly readable text should remain a valid source of truth.

OYB may attach internal IDs and metadata or eventually provide structured editing cards, but structure should assist editing and retrieval rather than make the user's knowledge opaque. Candidate facts extracted from imports must be reviewed before they are merged into the profile.

## Optional web research

Research should be an explicit per-fill option, initially off by default:

> **Research unfamiliar terms and products**  
> Allow the AI provider to use current public information to interpret these questions. Research will never be treated as evidence of your personal experience.

Research may be used for terminology, current product capabilities, market categories, and understanding what a question is asking. It must not establish the user's personal qualifications.

The review workspace should display the research sources used and keep them visually distinct from personal evidence. OYB should disclose additional provider cost and data sharing, handle provider capabilities explicitly, and avoid silently substituting unsupported model recollection when grounded search is unavailable.

Provider search APIs, citation formats, current limits, and ChatGPT export behavior are time-sensitive and must be verified against official documentation during implementation.

## Knowledge imports

### Professional-summary import

Support pasted or imported professional summaries as the first knowledge bootstrap. The importer should extract candidate facts, preview them, and let the user correct, exclude, or approve each item before merging anything into the durable profile.

This can extend the existing local document-import path. The interface must disclose which source text is sent to the selected provider for extraction.

### ChatGPT data-export import

Treat full ChatGPT export support as a later, separate feature. An export may contain irrelevant personal material, facts about other people, stale claims, contradictions, and sensitive conversations.

A safe importer would need local archive parsing, conversation or category selection, aggressive exclusion controls, candidate-fact extraction, deduplication, contradiction handling, and explicit review before saving. It should not retain the raw export by default or treat a ChatGPT memory summary as authoritative.

## Retrieval

Do not begin with vector search. Initially, use transparent local selection based on tags, shared terms and phrases, form category, and recency. Send the complete professional profile only while it remains reasonably small, and include a bounded set of relevant approved answers.

Move to chunk-level retrieval or embeddings only when actual profile and answer-library growth causes measurable problems with relevance, provider cost, latency, or data minimization. Retrieval should remain local where practical and should expose enough reasoning to make source selection understandable.

## Implementation phases

### Phase 1: Evidence foundation

Extend the provider-neutral prompt and response schema with evidence states, supporting references, and warnings. Validate all returned field and source identifiers. Add Node tests covering every state, malformed metadata, unsupported claims, duplicate results, and unresolved fields.

Completion gate: OYB can distinguish direct support, adjacent inference, missing information, and user judgment without changing its submission or sensitive-field behavior.

### Phase 2: Side-panel evidence review

Present provenance, supporting excerpts, and warnings in the planned side-panel workspace. Add accessible visual states without relying on color alone.

Completion gate: a user can understand why every filled or unresolved field received its status and can edit all inserted values before taking any external action.

### Phase 3: Approved-answer library

Add explicit saving of reviewed field values, local answer-library management, stale-information cues, and transparent keyword/tag retrieval.

Completion gate: a saved answer can improve a later related form, can be inspected or deleted, and is never created merely because OYB filled a field.

### Phase 4: Professional-summary import

Extract candidate professional facts from pasted text and supported documents, with preview and selective approval before merging.

Completion gate: imports cannot silently overwrite the profile or promote unreviewed model output to authoritative personal knowledge.

### Phase 5: Optional research

Add the per-fill research control, provider capability checks, source display, cost and sharing disclosure, and strict personal-evidence separation.

Completion gate: research improves interpretation of a test set of unfamiliar questions without producing unsupported claims about the user.

### Phase 6: Advanced imports and retrieval

Evaluate full ChatGPT export parsing and embedding-based retrieval only after the earlier review, merge, and answer-library workflows have been exercised with real use.

Completion gate: measured evidence shows that the added complexity improves usefulness or data minimization beyond the simpler workflows.

## Decisions deliberately deferred

- The exact storage schema and migration strategy.
- Whether structured profile cards are needed in addition to readable source text.
- Provider-specific research implementation and fallback behavior.
- Source citation retention and expiration rules.
- Contradiction-resolution behavior across profile facts and approved answers.
- The size threshold at which chunking or embeddings become worthwhile.
- Whether answer-library capture should support groups of related fields as one reusable record.

## Non-goals

- Autonomous navigation, submission, or progression through forms.
- Treating public research or model knowledge as personal experience.
- Automatic ingestion of an entire chat archive into authoritative knowledge.
- Saving generated answers without explicit review.
- Building an OYB-hosted account, backend, or vector database.
- Replacing deterministic sensitive-field handling with model judgment.

## Recommended next step

Design the Phase 1 response schema and evidence rules against several real expert-network questions before changing the interface. Use those examples to determine which supporting references the model can return reliably and which classifications OYB can validate deterministically.
