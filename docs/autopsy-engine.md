# Autopsy Engine

The verdict engine lives in `src/autopsy.js`. It is **pure**: no DOM, no `fetch`, no `localStorage`, no token. The browser UI (`assets/js/app.js`) and the Node test suite (`tests/`) import the same file, so a verdict you see in the browser is exactly the verdict the tests pin.

## API

```js
import { parseWebhookInfo, diagnose, classify409, fingerprintUrl,
         buildTimeline, sparklinePath, exportReport } from './src/autopsy.js';

// 1. Parse — accepts raw WebhookInfo, {ok, result}, or a JSON string.
const { info, getMe, error } = parseWebhookInfo(pastedJson);

// 2. Diagnose — needs the claimants table.
const d = diagnose({ info, getMe, error409: pasted409Line }, claimants);
// d = { verdict, label, confidence, summary, evidence[], fingerprint, notes[],
//       variant, pending, lastError, lastErrorDate, url }
```

## Verdicts

| Verdict | Meaning |
|---|---|
| `POLLING_HEALTHY` | No webhook set; the bot polls. If silent, the poller process is down. |
| `WEBHOOK_HEALTHY` | Webhook set, deliveries succeeding, nothing queued. |
| `WEBHOOK_FAILING` | Telegram is trying and failing (`last_error_message`), or a backlog is growing. |
| `WEBHOOK_STOLEN` | The webhook is claimed by an automation/tunnel consumer and deliveries back up. |
| `SECOND_POLLER_SUSPECTED` | A 409 says another poller terminated this one. **Suspected, never proven** — `getWebhookInfo` alone cannot prove a second poller. |
| `INVALID` | Input did not parse as `getWebhookInfo` output. |

## Evidence

Every diagnosis returns `evidence[]` — plain strings citing the exact field and value (`url = …`, `pending_update_count = 47`, `last_error_message = "…"`, `fingerprint: …`). The UI shows them verbatim. If a verdict cannot cite its evidence, it is a bug — file it.

## 409 branching (`classify409`)

- `terminated by other getUpdates request` → `other-getupdates`
- `can't use getUpdates method while webhook is active` → `webhook-active`
- `terminated by setWebhook request` → `setwebhook`
- anything else with `409` → `conflict-unknown` (shown, not branched)

## Timeline (`buildTimeline`)

Takes local samples `{sampledAt, url, pending_update_count}` and returns `{count, firstSeen, lastSeen, changes[], pendingValues[]}`. A URL change is reported as a **window** ("between sample A and sample B") — never an invented timestamp. `sparklinePath(values)` returns an inline-SVG path for the pending-count sparkline.

## Export (`exportReport`)

Markdown, redacted: verdict, evidence, fingerprint, notes, timeline. Hostnames only. No token — the function never receives one, and the test suite asserts no token-shaped string appears in the output.

## Testing

`tests/autopsy.test.js` runs 22 fixtures from `tests/fixtures/` (each a real-shaped `getWebhookInfo` payload + `expectedVerdict` + optional `expectedConfidence`). Add a fixture for every new rule. Run: `npm test` — 12/12.
