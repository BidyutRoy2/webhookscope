# Changelog

All notable changes to WebhookScope will be documented here.

## [0.1.1] — 2026-11-16

Design & UI fix after a live visual/interaction audit of webhookscope.vercel.app (14 findings).

### Fixed
- Link previews: `og:image` is now the absolute Vercel URL, plus `og:url`, `twitter:card` and `theme-color` meta (previews previously had no image).
- Hero: the demo video is now an inline `<video>` player with the hero image as its poster (was a bare mp4 link that navigated away from the site); hero image is capped so the fold is cleaner.
- Hero: "Try the demo bot" renamed to "See the live verdict" (it only scrolls to the Autopsy — there is no demo bot); the invalid `<a><button>` nesting is now a styled link.
- New live verdict line under the hero lede, updated by every diagnosis, so the demo result is visible without scrolling; "above the fold" claim removed from the hero caption and README.
- Verdict radar is now real: the verdict box renders an SVG radar (rings + sweep + blip, coloured by verdict) instead of text only.
- Clear now fully resets the tool: demo JSON restored, verdict border and hero line reset, fingerprint/notes/fix cleared, and the localStorage timeline wiped (it previously kept stale samples with no way to reset them).
- Timeline no longer adds a duplicate sample when the URL and pending count are unchanged.
- Failure playground now lists every active fault instead of showing only the worst one.
- Lesson Play button label no longer sticks on "Pause" after the animation finishes or after Reset.
- Live-mode check now refreshes the fingerprint and notes cards too (they previously showed stale results from the earlier run).
- Export now says "Run the autopsy first" instead of silently doing nothing when there is no diagnosis.
- Playground toggles are real 46px switches instead of 20px checkboxes.
- Mobile: flow table wrapped in a horizontal-scroll container, `pre` overflow guard, `overflow-x: clip` on the page, nav scrolls horizontally instead of wrapping to three lines.
- JSON textarea taller (200px) so the demo JSON no longer clips a line; section spacing tightened.
- JSON textarea now grows to fit its content, so the full demo JSON (16 lines) is visible without scrolling inside the box.
- Video caption no longer mixes the 18 s video length with the 10 s diagnosis claim; "Coming next" version reference updated to v0.1.1.
- Footer now links the live demo URL instead of "deploy via Vercel (see README)".

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
