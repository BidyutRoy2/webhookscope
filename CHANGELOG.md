# Changelog

All notable changes to WebhookScope will be documented here.

## [0.1.2] — 2026-11-16

Pro Polish — mobile, shareability, security headers, SEO, privacy, accessibility and repo polish. No change to the verdict engine, the demo JSON or the launch copy.

### Added
- Shareable state: "Copy share link" encodes the pasted JSON + stack + 409 line into the URL fragment (`#d=…`, base64url, Unicode-safe) — the fragment is never sent to any server; opening a share link restores the exact diagnosis. Links over ~50 KB are refused with a pointer to Export report.
- Sample presets above the Autopsy textarea: "Healthy webhook", "409 — second poller", "Stale webhook, pending queue" — one click each, labelled SAMPLE, no real bot.
- Privacy section (`#privacy`, linked from nav + footer): pasted JSON never leaves the browser, no analytics/trackers/cookies, localStorage only, live-token mode calls api.telegram.org directly; verifiable "DevTools → Network, zero requests fire" sentence; shared-link leak warning; "Clear my data" button wipes all `webhookscope:*` keys.
- Recent history strip under the Autopsy (localStorage only, max 5: verdict + host + time, click restores and runs, ✕ deletes one, "Clear all" wipes). Never stores a token.
- Copy buttons with "Copied ✓" feedback (reverts after ~2 s) on the verdict summary, the pasted JSON and the inspector output; keyboard shortcuts Ctrl/Cmd+Enter (run Autopsy) and Ctrl/Cmd+/ (toggle the shortcuts list), hinted on the run button.
- Video captions (`assets/demo.vtt`, 6 cues) + a visible Transcript details block under the hero video.
- SEO files: `robots.txt`, `sitemap.xml` (canonical homepage only), `<link rel="canonical">`, JSON-LD (SoftwareApplication + WebApplication, no rating anywhere).
- Content Security Policy in `vercel.json` (script-src 'self' only, frame-ancestors 'none') + 1-day cache headers for `/assets/*`; HTML is never long-cached.
- YAML issue forms (bug / feature / fingerprint-pattern) + `config.yml` with blank issues disabled; CI "claims" step fails on any analytics/tracking URL, any external `<script src>`, `'unsafe-eval'` or `'unsafe-inline'` in script-src.
- Hero poster preload (`<link rel="preload" as="image" fetchpriority="high">`).

### Fixed
- iOS input zoom: all text inputs, textareas and selects are now 16px.
- Mobile bundle: buttons/links min-height 44px, `touch-action: manipulation`, hover rules gated behind `@media (hover:hover) and (pointer:fine)`, `:active` press states (~0.97 scale), `viewport-fit=cover` + safe-area padding on the sticky header/footer, `scroll-margin-top: 72px` on sections.
- JSON errors are now pinpointed: "Line X, column Y: …" with a "Jump to error" button that focuses the textarea and selects the offending character; valid-JSON-but-wrong-shape is distinguished ("Valid JSON — but this doesn't look like getWebhookInfo output…"); pasted JSON is never cleared; `aria-invalid` is set on error.
- Accessibility: skip link ("Skip to main content") + `<main id="main" tabindex="-1">`, global `:focus-visible` ring (3px cyan, 2px offset), focus moves to the verdict box after an Autopsy run and back to the textarea on Clear.
- Reduced motion: `prefers-reduced-motion` disables the radar sweep, transitions and smooth scrolling. The hero video keeps native controls and never autoplays with sound — no custom pause button added.
- Failure-Lab switches now have `role="switch"` and a visible On/Off text state.
- Contrast audit: all text pairs were already ≥ 4.5:1, but the `--line` border colour failed WCAG 1.4.11 (1.42:1 vs background, 1.30:1 vs panel — needs 3:1). `--line` changed `#1d2f33` → `#43707a` (3.61:1 vs background, 3.32:1 vs panel, 3.14:1 vs panel2).
- Social preview re-exported to exactly 1200×630 (centre crop) with matching `og:image:width/height/alt`, `og:site_name`, `og:locale`.
- Footer now shows "v0.1.2 — 16 Nov 2026 · What's new →" linking to the v0.1.2 release.
- `<noscript>` block: honest message + links to the Flow lesson, Token safety and GitHub source.

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
