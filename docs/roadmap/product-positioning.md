# Product Principles and Positioning

## Why OYB exists

General-purpose browser agents can navigate interfaces, enter information, and coordinate broad workflows. OYB serves a different need: applying known personal information to a form that the user has already opened, quickly and conservatively.

OYB is a focused review tool built around a user-owned profile. It prioritizes predictable behavior, visible changes, and user approval over autonomous task completion.

## What OYB prioritizes

- Works in the user's existing tab and signed-in browser session.
- Fills a page with one explicit action rather than requiring a conversational browser task.
- Uses an explicit, editable, portable personal profile as the source of truth.
- Never submits a form or clicks a next, continue, or progression control.
- Skips sensitive fields according to deterministic extension logic rather than relying only on model judgment.
- Highlights inserted answers for review and reports missing facts and judgment calls instead of silently inventing them.
- Lets the user choose an AI provider and use a personal API key.
- Has no OYB backend, account, analytics, or telemetry.

## When a general browser agent is a better fit

General agents are a better fit when the task includes finding a form, navigating many steps, researching an organization, tailoring documents or prose, uploading files, and coordinating a complete workflow.

Browser autofill may be sufficient for occasional basic forms. OYB is designed for people who repeatedly complete consequential forms, including job seekers, grant applicants, school applicants, people navigating benefits or administrative processes, procurement respondents, and users who benefit from a simpler accessibility-oriented review flow.

## Positioning

The product promise should be:

> Your information. Your browser. Nothing submitted without you.

The practical distinction is:

- General agent: "Find the application, navigate it, research what is needed, and complete as much of the workflow as possible."
- OYB: "I am already on this form. Apply my known information quickly and conservatively, show me what you changed, and leave the decisions and submission to me."

## Priorities that reinforce the position

1. Make onboarding and profile creation substantially easier.
2. Make rescanning multi-step and conditional forms reliable.
3. Show the provenance of each answer: direct profile fact, model inference, missing information, or user judgment required.
4. Add safe profile export and re-import; consider local-model support when it is practical.
5. Maintain a measurable speed and predictability advantage: click once, review, submit.

## Intentional product boundary

OYB should not try to match general agents at autonomous navigation, research, uploads, or end-to-end task completion. Its safety constraints are part of the product, not temporary limitations.

OYB deliberately remains a focused, local-first utility rather than becoming a general autonomous agent. Its user-owned profile, deterministic safety rules, review experience, and small architecture provide meaningful control without requiring an OYB account or backend.

## Current market references

These references, reviewed in August 2026, illustrate the direction of general-purpose browser agents. OYB's product principles do not depend on the capabilities or availability of any one agent.

- [OpenAI computer-use API reference](https://developers.openai.com/api/reference/ruby/resources/beta/subresources/responses)
- [OpenAI ChatGPT and Codex use cases](https://learn.chatgpt.com/use-cases)
