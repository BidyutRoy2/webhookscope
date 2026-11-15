# Support

## Getting help

1. Read the **Token safety** section in the README and `docs/fingerprinting-confidence.md` first — most "wrong verdict" reports are a confidence question, not a bug.
2. Check `examples/` — paste the demo JSON and confirm the demo verdict (STOLEN by n8n) works.
3. Open a GitHub issue with: the verdict you got, the verdict you expected, and the **redacted** report from Export (hostnames only — never paste a real token).

## What this tool does not do

- It does not monitor your bot, send alerts, or store anything server-side (there is no server).
- It does not delete or set webhooks for you — you run the copied command yourself.
- It cannot prove a second poller from `getWebhookInfo` alone — that verdict is always "suspected", with a checklist.

## Response time

This is a one-maintainer open-source project. Issues with a reproduction (fixture JSON + expected verdict) get answered first.
