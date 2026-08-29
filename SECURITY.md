# Security Policy

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public issue, discussion, pull request, or screenshot.

Use GitHub's private vulnerability reporting for this repository when the **Report a vulnerability** option is available on the Security tab. If private reporting is unavailable, open a public issue that asks the maintainer to establish a private contact channel, but do not include vulnerability details, proof-of-concept code, credentials, personal information, or affected form data in that issue.

In the private report, include:

- A concise description of the issue and its potential impact.
- The affected OYB version or commit.
- Reproduction steps using synthetic data whenever possible.
- Any browser, operating-system, or provider details needed to reproduce it.
- Suggested mitigations, if known.

Do not test against accounts, forms, or data you do not own or have permission to use. Never include real API keys, browser profiles, cookies, completed forms, or other people's personal information.

The maintainer will acknowledge a usable private report as soon as practical, investigate it, and coordinate disclosure based on severity and the availability of a fix. This volunteer project does not currently promise a fixed response or remediation time.

## Scope

Security concerns include unintended disclosure of profiles or API keys, unsafe provider requests, prompt-injection boundary failures, filling excluded sensitive fields, automatic submission or navigation, permission expansion, and dependency vulnerabilities that affect the shipped extension.

General bugs, compatibility problems, and feature requests that do not expose sensitive information can use the public issue tracker.
