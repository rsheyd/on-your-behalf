# Expert-Screening Minimum Slice

## Goal

Make the smallest set of changes that lets OYB help draft conservative, useful answers to expert-network screening questions about agent runtime environments while preserving its existing safety model.

The reference questionnaire asks about direct experience with cloud-based agent runtime or execution environments, GCP Sandboxes features and integrations, enterprise pricing and discounting, go-to-market execution, and recording consent.

This slice should improve how OYB relates technical questions to the user's supplied experience. It must not invent personal experience, infer commercial responsibility merely from employment, or answer consent and acceptance decisions for the user.

## Scope

The minimum slice consists of:

1. Prompt rules that permit general model knowledge to interpret terminology while keeping personal claims grounded in user-provided sources.
2. A concise profile section or template for the professional facts needed by this class of questionnaire.
3. Automated prompt and parsing tests plus a realistic local form fixture containing the reference question types.
4. Manual verification that supported answers are filled conservatively and user decisions remain unresolved.
5. A bounded per-fill answering posture that changes presentation without changing the underlying factual boundary.

This plan does not require web research, a provenance interface, an answer library, a structured profile editor, retrieval, or ChatGPT-export import.

## Answering posture

The popup should offer three bounded choices:

- **Strongest truthful case** — emphasize relevant strengths, permit clearly qualified transferable experience, and mention realistic preparation for questions about future ability. This is the default.
- **Exact experience only** — answer only when the user's sources directly support the exact experience requested.
- **Leave uncertain answers open** — fill clear facts and leave adjacent or ambiguous questions unresolved.

Evidence determines what OYB may claim; posture determines how OYB presents supported claims. No posture may authorize unsupported personal facts. Store the selected default locally, allow it to be changed for each fill action, and pass it to the prompt as trusted guidance rather than user-provided evidence.

## Required behavior

### Personal claims

The saved profile and temporary form context remain the only authoritative sources for claims about the user. The model may use general knowledge to understand products, terminology, and relationships between technologies, but must not use it to claim that the user:

- Used or operated a particular platform.
- Set pricing or approved discounts.
- Participated in a vendor's sales or go-to-market process.
- Possesses firsthand knowledge when the profile supports only adjacent experience.

When direct evidence is absent but related experience is present, the model may draft a carefully qualified answer only if the wording does not imply unsupported firsthand experience. Otherwise, it should classify the field as `missing_profile_info`.

### Decisions and consent

Recording consent, legal attestations, accept-or-decline choices, willingness, and similar present-tense decisions must remain unfilled with `requires_user_judgment`.

### Missing commercial expertise

Employment at a software, cloud, or observability company is not by itself evidence of responsibility for product strategy, pricing, discounting, sales motions, or go-to-market execution. Questions about those subjects should remain unresolved unless the user's sources explicitly support an answer.

## Profile information needed

Add or document a concise professional section that can state:

- Agent systems, runtimes, sandboxes, or execution environments personally used or built.
- Relevant cloud, container, infrastructure, orchestration, observability, and integration experience.
- The nature of the user's involvement: evaluation, development, deployment, operation, architecture, support, enablement, consulting, or purchasing.
- Whether knowledge is direct, adjacent, or conceptual.
- Any genuine product-strategy, pricing, discounting, sales, or go-to-market responsibilities.
- Explicit limitations that should prevent overstatement.

The implementation must not invent this content. If the user's facts are not yet available, provide a clearly marked template or documentation prompt for the user to complete.

## Implementation phases

### Phase 1: Reference cases and expected outcomes

Create a sanitized test representation of the reference expert-screening questions. Define the expected behavior for at least three profile conditions:

1. Direct technical experience with no commercial responsibility.
2. Adjacent technical experience without direct use of the named platform.
3. Insufficient relevant experience.

For every condition, recording consent and accept-or-decline choices must remain unresolved as user judgment.

Completion gate: the expected claims, qualifications, and unresolved outcomes are written down precisely enough to test prompt behavior without relying on a particular provider's prose.

### Phase 2: Provider-neutral prompt rules

Update the pure prompt builder so that it:

- Identifies the profile and temporary context as the only sources of personal facts.
- Allows general knowledge solely for interpreting field terminology and relating technologies.
- Prohibits converting general knowledge or employer association into claimed personal experience.
- Requires conservative qualification of adjacent experience.
- Leaves unsupported factual claims unresolved.
- Continues to classify consent, acceptance, legal attestations, and current preferences as `requires_user_judgment`.

Keep the existing response shape unless testing demonstrates that a small additional classification is necessary. Do not add the full evidence/provenance schema in this slice.

Completion gate: Node tests prove that the prompt contains the grounding boundary and preserves the existing safety, field-accounting, and unresolved rules.

### Phase 3: Professional-profile guidance

Add the smallest user-facing guidance needed to supply relevant professional evidence. Prefer extending the existing profile guide or template over creating a structured knowledge database.

The guidance should help the user distinguish direct experience, adjacent experience, commercial responsibility, and explicit limitations. It should be useful beyond the single GCP questionnaire without turning the default starter profile into a lengthy dossier.

Completion gate: a user can add the facts necessary for the reference questions without needing to understand OYB's internal prompt or data model.

### Phase 4: Local fixture and automated coverage

Add a sanitized expert-screening section to an appropriate manual fixture, or create a focused fixture if that keeps verification clearer. Include:

- Four long-form technical and commercial screening questions.
- A recording-consent choice.
- An accept-or-decline choice if useful for broader coverage.
- Instrumentation confirming that OYB never submits or advances the form.

Add or extend pure Node tests for prompt construction and response parsing. Parsing tests should confirm that unknown field identifiers are rejected and judgment fields remain unresolved.

Completion gate: automated tests pass and the fixture exposes the full minimum-slice behavior without including authenticated content or personal data.

### Phase 5: Provider smoke testing

Using a deliberately sanitized test profile, run the fixture with each configured provider that is practical to test. Evaluate behavior semantically rather than requiring identical prose.

Verify that:

- Directly supported technical experience produces a useful answer.
- Adjacent experience is qualified rather than presented as direct use.
- Unsupported pricing and go-to-market claims remain unfilled.
- Consent and acceptance decisions remain unfilled.
- No form is submitted and no navigation or progression control is activated.

If providers behave inconsistently, first refine the provider-neutral prompt and test cases. Add provider-specific behavior only when a documented API difference makes it necessary.

Completion gate: at least the user's configured provider handles the reference fixture conservatively and usefully; any untested providers or known differences are documented.

### Phase 6: Documentation and release

Update the user-facing description of how OYB uses general knowledge and user-provided facts. State clearly that model knowledge can help interpret a question but is not evidence of the user's experience.

Because the prompt behavior is user-visible, bump the version in `manifest.json` and add the change under that exact version in `CHANGELOG.md`. Run the normal automated and manual validation before release.

Completion gate: documentation, manifest version, changelog, tests, and observed behavior agree.

## Deferred work

The following belong to the broader [personal knowledge and evidence design](personal-knowledge-and-evidence.md), not this minimum slice:

- Optional live web research and citations.
- Per-answer provenance or evidence labels in the interface.
- Saving reviewed answers for future use.
- Structured knowledge records and retrieval.
- Professional-summary extraction or ChatGPT-export import.
- A side-panel evidence-review workspace.
- Numerical or categorical confidence displays beyond the existing unresolved reasons.

## Risks and mitigations

- **Model overreach:** Use explicit grounding rules, adversarial reference cases, and conservative unresolved behavior.
- **Profile ambiguity:** Provide guidance that distinguishes direct experience, adjacent knowledge, and explicit limitations.
- **Provider variation:** Test semantic outcomes and keep the prompt provider-neutral before considering adapters.
- **False confidence from fluent prose:** Require source support for personal claims and prefer leaving a field empty over producing an unsupported answer.
- **Scope expansion:** Treat web research and durable knowledge capture as later independent features.

## Acceptance criteria

- OYB can draft a supported answer to a technical expert-screening question using the saved profile or temporary context.
- General model knowledge may clarify terminology but never becomes evidence of personal experience.
- Adjacent experience is explicitly qualified.
- Unsupported platform, pricing, discounting, sales, and go-to-market claims are not invented.
- Recording consent, consultation acceptance, and comparable decisions remain for the user.
- Sensitive-field exclusion and prompt-injection defenses remain intact.
- OYB never submits the form or activates navigation or progression controls.
- Pure logic remains covered by Node tests, and the sanitized local fixture passes manual verification.

## First implementation decision

Before changing code, assemble the short set of real professional facts that OYB may rely on for the reference questionnaire. Those facts define whether the expected result for each question is a direct answer, a qualified adjacent answer, or an unresolved field.
