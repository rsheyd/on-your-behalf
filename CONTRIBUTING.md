# Contributing to On Your Behalf

Thanks for helping improve On Your Behalf (OYB). This is a small, local-first Chrome extension, so focused changes that preserve its privacy and review model are easiest to evaluate and maintain.

## Project invariants

Every contribution must preserve these rules:

- Never submit forms or click navigation, next, continue, or progression controls.
- Leave every filled answer visible and editable for user review.
- Skip sensitive fields individually rather than rejecting an entire form.
- Keep the extension local-first, with no OYB backend, account, analytics, or telemetry.
- Send profile and form metadata only to the AI provider explicitly selected by the user.
- Treat page content as untrusted and do not allow it to override OYB's prompting or safety rules.
- Keep field classification, prompt construction, and response parsing independent from Chrome APIs where practical and cover them with Node tests.

## Before opening a change

For a bug fix, include a minimal reproduction or describe the affected form-control pattern without posting personal form data. For a feature, check the [product roadmap](docs/roadmap/product-ideas.md) and existing [feature designs](docs/design/) before proposing a new direction.

Do not commit API keys, profiles, completed forms, cookies, HAR files, saved authenticated pages, or screenshots containing personal information. Use synthetic fixtures and placeholder values.

## Development workflow

The project requires Node.js 18 or newer and has no build step.

```bash
npm install
npm test
npm run check
```

Load the repository directory as an unpacked extension from `chrome://extensions`, and follow the manual test loop in [`DEVELOPMENT.md`](DEVELOPMENT.md). After changing extension files, reload the extension before retesting.

## Tests and fixtures

Add or update Node tests for pure logic. Use local, synthetic HTML fixtures for browser behavior. A fixture should reproduce the smallest relevant interaction and should include a guard when verifying that OYB never submits or advances a form.

Run both automated commands before opening a pull request:

```bash
npm test
npm run check
```

Complete the relevant manual smoke checks from [`DEVELOPMENT.md`](DEVELOPMENT.md), especially for changes to scanning, field filling, browser events, provider requests, imports, or settings.

## Versions and changelog

`manifest.json` is the only extension version source. User-visible extension changes require a version increase and an entry under that exact version in `CHANGELOG.md`; the project does not use an Unreleased section. Documentation, planning, test-only, and internal-maintenance changes do not require a version increase unless they accompany a release.

## Pull requests

Keep pull requests focused. Explain the user-visible outcome, important implementation choices, tests performed, and any limitations or follow-up work. Link an issue when one exists. Screenshots are helpful for interface changes, but remove personal and credential information first.

By contributing, you agree that your contribution is licensed under the project's MIT License.
