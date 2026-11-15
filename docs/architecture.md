# Architecture

WebhookScope v0.1.0 is a **static site with no backend, no database, no accounts, no build step**. One HTML file, one CSS file, one UI script, three pure JS modules, one JSON data table.

```
index.html                  entry point (all sections)
assets/css/style.css        dark forensic theme
assets/js/app.js            UI only: wires DOM ↔ engine, lesson player,
                            playground, inspector, timeline (localStorage)
src/autopsy.js              PURE verdict engine — no DOM, no fetch, no storage.
                            Imported by app.js AND by the Node test suite.
src/fixes.js                framework fix cards (data, copyable commands)
src/update-inspector.js     PURE Update decoder
data/claimants.json         fingerprint patterns v1.0.0 (host/path regexes)
examples/                   sample getWebhookInfo + Update JSONs
tests/ + tests/fixtures/    node:test, 22 fixtures
```

## Data flow — Autopsy

```
getWebhookInfo JSON (paste, or browser fetch in live mode)
        │
        ▼
parseWebhookInfo()          unwraps {ok,result}, validates shape
        │
        ▼
diagnose(info, claimants)   verdict + confidence + evidence + fingerprint + notes
        │
        ▼
UI renders: verdict radar, fingerprint card, notes, timeline, fix card
```

`diagnose()` never reads a token, never touches the network, never touches storage. The timeline (`localStorage`, namespaced `webhookscope:autopsy:timeline`, max 50 samples) is the only persisted state, and it stores only `{sampledAt, url, pending_update_count}`.

## Verdict logic (summary — see `src/autopsy.js` for the exact code)

| Condition | Verdict |
|---|---|
| 409 `terminated by other getUpdates` | SECOND POLLER suspected (High) |
| No URL, no 409 | POLLING — healthy |
| URL + `terminated by setWebhook` 409 | WEBHOOK — STOLEN |
| URL fingerprints as automation/tunnel + pending > 0 or last error | WEBHOOK — STOLEN (High) |
| URL fingerprints as automation, healthy | WEBHOOK — healthy (+ warning) |
| URL + last_error_message | WEBHOOK — failing |
| URL + pending > 0, no error | WEBHOOK — failing |
| URL, no error, no queue | WEBHOOK — healthy |

Fingerprinting requires a **host-pattern match**; a path pattern alone (e.g. generic `/webhook`) never fingerprints anyone — that false positive was caught by the test suite (see CHANGELOG / test `fingerprintUrl: n8n, ngrok, unknown`).

## Why no framework?

The app is one page of DOM + a small engine. A framework would add a build step, a deploy risk, and nothing the user can see. Vercel serves the files as-is; GitHub Pages serves the same files as a mirror.

## Adding a feature

- **New verdict rule** → `src/autopsy.js` + a fixture in `tests/fixtures/` + a test expectation. Never change a verdict without a fixture.
- **New claimant** → `data/claimants.json` + the fingerprint-pattern issue template rules (host match required, confidence, verify step).
- **New framework fix** → `src/fixes.js` + a test in `tests/autopsy.test.js`.
- **New lesson / playground scenario** → `assets/js/app.js` (lesson data) — keep it a simulation, labelled as one.
