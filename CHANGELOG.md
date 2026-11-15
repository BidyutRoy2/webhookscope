# Changelog

All notable changes to WebhookScope will be documented here.

## [0.1.0] — 2026-11-16

### Added
- **Silent Bot Autopsy (killer feature):** paste `getWebhookInfo` JSON (no token) → verdict radar (POLLING healthy / WEBHOOK healthy / WEBHOOK failing / WEBHOOK STOLEN / SECOND POLLER suspected) with High/Medium/Low confidence + evidence bullets citing exact fields.
- Claimant fingerprinting from `data/claimants.json` v1.0.0 (n8n, OpenClaw, ngrok, Railway, Vercel, Render, Fly, Hookdeck, Hooklistener, webhooks.cc, bare-IP) — unknown hosts stay Unknown, never a guess.
- Claim timeline (localStorage only) with pending-count sparkline and URL-change events.
- 409-variant branching (other-getUpdates / webhook-active / setWebhook).
- Framework fix cards for aiogram, python-telegram-bot, Telegraf, grammY, n8n, OpenClaw — copyable, `drop_pending_updates` warning, default keeps the backlog.
- Optional collapsed browser-only live mode (token cleared after the check, revoke reminder).
- Export redacted report (Markdown/JSON, hostnames only, no token).
- Animated flow lesson (polling vs webhook, Play/Step/Reset + flow table), failure-injection playground, paste-Update inspector.
- Demo scenario pre-filled above the fold: "3-day silent bot, diagnosed in 10 seconds" (n8n, pending 47, last error 502).
- Pure verdict engine `src/autopsy.js` shared by browser + Node tests; 22 fixtures; 12/12 tests pass.
- Vercel-ready static site (vercel.json, Deploy to Vercel button, no build step, no env vars). GitHub Pages mirror noted.
- Full professional pack: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT, CHANGELOG, CI, issue/PR templates, dependabot, docs, examples, hero image + demo video + social preview.

### Not in v1 (deliberate)
- No server, accounts, monitoring, live alerting, or auto deleteWebhook/setWebhook.
- No Coverage X-Ray / Live Handler Trace / Time-Travel Replay (roadmap, "coming next" only).
