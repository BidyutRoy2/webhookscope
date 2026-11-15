# Deploy on Vercel

WebhookScope is a static site at the repo root. **No build step. No environment variables. No server.**

## One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BidyutRoy2/webhookscope)

## Manual steps

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**.
2. **Import** the GitHub repo `BidyutRoy2/webhookscope`.
3. Framework Preset: **Other** (static).
4. Build Command: *(leave empty)*. Output Directory: *(leave as root)*.
5. Environment Variables: **none**.
6. Click **Deploy**.

The live URL is https://webhookscope.vercel.app/ — it is already pasted into the README where it says "Live demo" (top of the file).

## After deploy — verify (2 minutes)

1. Open the live URL. The demo verdict must already show **WEBHOOK — STOLEN: claimed by another consumer, High confidence** — the demo auto-runs on load.
2. Click **Load demo**, then **Autopsy my bot** — same verdict, evidence bullets visible.
3. Play the flow lesson once (Play → 5 steps, table fills).
4. Open the page on a phone-width viewport — no horizontal scroll.

## Every push redeploys

Vercel watches `main`. Push a fix, the live site updates in under a minute. Preview deployments are created for pull requests automatically.

## GitHub Pages mirror (optional)

Same static files: repo Settings → Pages → Deploy from branch `main`, folder `/ (root)`. One line, as promised — Vercel is the main launch; Pages is only a mirror.

## Custom domain (later, optional)

Vercel dashboard → Project → Settings → Domains → add `webhookscope.dev` (or your domain) and follow the DNS instructions. Nothing in the code needs to change.
