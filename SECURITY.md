# Security Policy

## Token safety is the product

WebhookScope is a static site with no backend, no database, no accounts, and no analytics on input fields. It cannot see your token — and it is designed so it never needs to.

- **Default flow uses no token at all.** `getWebhookInfo` JSON contains no secret.
- **Live mode is browser-only.** A pasted token is sent by your browser directly to `api.telegram.org`, is never stored, and is cleared from the page after the check.
- **This page never calls `deleteWebhook` or `setWebhook`.** You copy the command and run it yourself.

## Reporting a vulnerability

Open a GitHub issue (do **not** include a real bot token — redact it first) or contact the maintainer via GitHub. Please describe the issue, the affected file, and steps to reproduce.

## What not to report

- That a fingerprint is "wrong" for an unknown host: fingerprinting is probabilistic by design. Open a **fingerprint pattern** issue instead, with the host shape and evidence.
- That past claim times cannot be reconstructed: that is a Telegram API limitation, documented in `docs/fingerprinting-confidence.md`, not a bug.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅ |
