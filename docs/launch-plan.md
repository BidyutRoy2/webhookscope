# Launch Plan — WebhookScope v0.1.0

**Window: Mon 16 – Tue 17 Nov 2026, 12:00–17:00 UTC.** One launch per evening, sequenced after reviewvet (Mon 16 Nov evening) in the daily-repo queue. WebhookScope is the next slot after reviewvet — do not stack two launches in one evening.

> Uploading without launching leaves the repo invisible. GitHub gives new repos essentially no organic distribution — the first stars come from outside GitHub in a compressed 24–48 h burst.

## Pre-launch checklist (Mon 16 Nov, before 12:00 UTC)

- [ ] Empty public repo `webhookscope` created on github.com/new (no README/license) — owner.
- [ ] All repo files pushed; `index.html` + `assets/` + `data/claimants.json` verified live on the public tree.
- [ ] `ci.yml` + binary assets (`hero.png`, `social-preview.png`, `demo.mp4`, `demo.gif`) uploaded via web UI (push_files cannot carry binaries/CI).
- [ ] CI green on the repo (Node 18/20/22, ubuntu-24.04).
- [ ] Vercel import done (docs/vercel-deploy.md); live URL verified: demo verdict STOLEN on load, lesson plays, no horizontal scroll on mobile.
- [ ] README "Live demo" line updated with the real Vercel URL.
- [ ] Repo description + 20 topics added (one at a time with Enter, never comma-pasted) — see SEO pack `metadata.md`.
- [ ] Social preview set in repo Settings (1280x630 `social-preview.png`).
- [ ] Release v0.1.0 created from tag `v0.1.0` with CHANGELOG notes.

## Launch posts (copy-paste ready — full text in the SEO pack)

| Slot (UTC) | Channel | Hook |
|---|---|---|
| Mon 16 Nov, 12:00 | **Hacker News — Show HN** | "Show HN: Silent Bot Autopsy — find out which service stole your Telegram bot's updates". Lead with the demo (n8n stole it for 3 days), the JSON-paste-no-token angle. Be in the comments with the Melardenio story. |
| Mon 16 Nov, 13:30 | **Reddit r/TelegramBots** (primary) | Demo + "paste JSON, no token" as the hook. |
| Mon 16 Nov, 15:00 | **Reddit r/n8n** | The n8n-trigger-steals-token story, framed as a diagnostic, not an attack on n8n. |
| Mon 16 Nov, 16:00 | **dev.to** (`telegram`, `telegram-bot`, `webhooks`, `debugging`, `n8n`, `showdev`) | "My Telegram bot was silent for 3 days — an n8n workflow had stolen its token" (Melardenio pattern, retold as a WebhookScope demo). |
| Tue 17 Nov, 12:00 | **Reddit r/selfhosted** | Stale-deploy / second-instance angle. |
| Tue 17 Nov, 13:30 | **Reddit r/OpenClaw** | 409 / second-poller angle — check the subreddit's self-promo rules first. |
| Tue 17 Nov, 15:00 | **Bot-framework communities** | aiogram chat / GitHub Discussions, grammY chat, python-telegram-bot discussion, Telegraf Discussions, n8n forum ("how to diagnose a stolen token", link as the tool, not a pitch). |

One tailored post per subreddit — never a cross-post blast.

## What NOT to claim in launch posts

- No star counts, no "most common" without citing Conferbot.
- No fingerprint certainty above the evidence — say "probabilistic, with confidence + evidence".
- No "deployed" claim until the Vercel URL is verified live.

## After launch (Tue 17 Nov evening)

- Record outcomes (views, stars, comments, issues) in the repo log / launch tracker.
- Triage fingerprint-pattern issues first — they are the cheapest high-value contributions.
- If a launch slot is missed (repo 404 at the 17:30 gate), release the slot to the next repo instead of holding it.
