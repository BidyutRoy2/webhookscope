# Contributing to WebhookScope

Thanks for helping! This is a static, browser-only tool — no backend, no build step.

## Quick start

```bash
npm test          # must pass before any PR
python3 -m http.server 8000   # open http://localhost:8000
```

## What to contribute

- **New fingerprint patterns** in `data/claimants.json` — the highest-value PR. Rules: one pattern per host family, a `verify` step, a confidence (high only with a host match + evidence), and **never a guess**. Unknown hosts stay Unknown.
- **New fixtures** in `tests/fixtures/` — a real-shaped `getWebhookInfo` payload + expected verdict. Name it clearly.
- **Fix-card improvements** — exact commands for a framework, tested by you.
- **Docs / copy** — plain English, honest confidence, no invented numbers.

## Rules

1. `npm test` must stay green (12/12). Add a fixture for every verdict change.
2. Never store, send, or log a bot token — in code, tests, fixtures, or screenshots. Fixtures use `example.com` hosts and fake IPs (`203.0.113.x`).
3. Fingerprinting is probabilistic: show confidence + evidence, never assert a claimant as fact.
4. No server-side code, no dependencies, no framework. Plain HTML/CSS/JS only.
5. Keep the demo honest: the demo JSON is labelled DEMO and uses no real token.

## PR process

Fork → branch → `npm test` → PR with a short description + which fixture proves the change. Small PRs beat big ones.
