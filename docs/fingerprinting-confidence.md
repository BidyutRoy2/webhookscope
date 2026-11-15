# Fingerprinting & Confidence — read this before trusting a verdict

## The honest limit

Telegram publishes **no "who set this webhook" API**. `getWebhookInfo` tells you the URL, the IP, the pending count, and the last error — not who registered it, and not when. Any tool that claims certainty about the claimant is guessing. WebhookScope does not guess.

## How fingerprinting works

`data/claimants.json` v1.0.0 is a table of host/path patterns:

- **Host match required.** A pattern only fires when the webhook hostname matches (e.g. `*.n8n.cloud`, `*.ngrok-free.app`, `*.up.railway.app`). A generic path like `/webhook` alone never fingerprints anyone — that false positive was caught in testing.
- **Path match boosts.** When the host matches, a path pattern (e.g. n8n's `/webhook/<uuid>`) raises the match quality.
- **Confidence is carried everywhere.** High = host + path both matched, or host matched for a service whose only job is claiming webhooks (n8n, ngrok). Medium = host matched for a general host (Railway, Vercel, Render, Fly — the URL could be yours). Low = hint only. Unknown hosts stay **Unknown**.

## What a verdict means

| Confidence | Read it as |
|---|---|
| High | "The evidence points strongly at this claimant — verify it with the check listed, then act." |
| Medium | "This looks like that kind of consumer. Verify before you delete anything." |
| Low / Unknown | "We cannot tell from this URL. Here is the checklist of places to look." |

## What cannot be verified

- **Past claim times.** Telegram exposes only `last_error_date` and the current pending count. The timeline is built by sampling forward; a claim is shown as a window between two samples, never a timestamp.
- **Second pollers.** With an empty `url`, a second poller leaves no trace in `getWebhookInfo`. That verdict is always "suspected", inferred from a pasted 409 line + a checklist.
- **Self-hosted automation.** An n8n on your own VPS looks like "bare IP / unknown host". The fingerprint says Unknown and tells you to check your servers — it does not invent a name.
- **Absence claims.** "No tool does X" (in the research) means no public tool was found in searches on 15–16 Nov 2026 — not proof that none exists.

## Contributing a pattern

Open a fingerprint-pattern issue (template in `.github/ISSUE_TEMPLATE/fingerprint-pattern.md`): host shape, evidence, suggested confidence, how to verify. Patterns without evidence are not merged.
