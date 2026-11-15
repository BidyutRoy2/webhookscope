import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseWebhookInfo, diagnose, classify409, fingerprintUrl, buildTimeline, sparklinePath, exportReport } from '../src/autopsy.js';
import { inspectUpdate } from '../src/update-inspector.js';
import { FIXES } from '../src/fixes.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const claimants = JSON.parse(readFileSync(path.join(dir, '..', 'data', 'claimants.json'), 'utf8'));
const fixtures = readdirSync(path.join(dir, 'fixtures')).filter((f) => f.endsWith('.json'));

test('all fixtures return their expected verdict', () => {
  assert.ok(fixtures.length >= 20, `expected >=20 fixtures, got ${fixtures.length}`);
  for (const f of fixtures) {
    const fx = JSON.parse(readFileSync(path.join(dir, 'fixtures', f), 'utf8'));
    const d = diagnose({ info: fx.info, getMe: fx.getMe || null, error409: fx.error409 || '' }, claimants);
    assert.equal(d.verdict, fx.expectedVerdict, `${f}: got ${d.verdict}, want ${fx.expectedVerdict}`);
    if (fx.expectedConfidence) assert.equal(d.confidence, fx.expectedConfidence, `${f}: confidence`);
    assert.ok(d.evidence.length >= 2, `${f}: evidence bullets`);
    assert.ok(d.summary.length > 20, `${f}: summary`);
  }
});

test('demo fixture is STOLEN by n8n with high confidence', () => {
  const fx = JSON.parse(readFileSync(path.join(dir, 'fixtures', 'stolen-n8n-demo.json'), 'utf8'));
  const d = diagnose({ info: fx.info }, claimants);
  assert.equal(d.verdict, 'WEBHOOK_STOLEN');
  assert.equal(d.confidence, 'high');
  assert.equal(d.fingerprint.id, 'n8n');
  assert.equal(d.pending, 47);
});

test('parseWebhookInfo unwraps {ok,result} and rejects bad JSON', () => {
  const { info, error } = parseWebhookInfo('{"ok":true,"result":{"url":"","pending_update_count":0}}');
  assert.equal(error, null); assert.equal(info.url, '');
  const bad = parseWebhookInfo('not json');
  assert.equal(bad.info, null); assert.ok(bad.error);
  const notInfo = parseWebhookInfo('{"hello":1}');
  assert.equal(notInfo.info, null);
});

test('classify409 branches the three variants', () => {
  assert.equal(classify409('Conflict: terminated by other getUpdates request; make sure that only one bot instance is running'), 'other-getupdates');
  assert.equal(classify409("Conflict: can't use getUpdates method while webhook is active"), 'webhook-active');
  assert.equal(classify409('Conflict: terminated by setWebhook request'), 'setwebhook');
  assert.equal(classify409(''), null);
});

test('fingerprintUrl: n8n, ngrok, unknown', () => {
  assert.equal(fingerprintUrl('https://x.n8n.cloud/webhook/abc/telegram', claimants).id, 'n8n');
  assert.equal(fingerprintUrl('https://abcd.ngrok-free.app/hook', claimants).id, 'ngrok');
  const u = fingerprintUrl('https://bot.example.com/webhook', claimants);
  assert.equal(u.id, 'unknown');
  assert.equal(fingerprintUrl('', claimants).id, 'unknown');
});

test('second-poller is indirect: empty url + 409 line, never proven from getWebhookInfo alone', () => {
  const d = diagnose({ info: { url: '', pending_update_count: 0 }, error409: 'terminated by other getUpdates request' }, claimants);
  assert.equal(d.verdict, 'SECOND_POLLER_SUSPECTED');
});

test('timeline: URL change is a window, not an invented timestamp', () => {
  const tl = buildTimeline([
    { sampledAt: '2026-11-16T00:00:00Z', url: '', pending_update_count: 0 },
    { sampledAt: '2026-11-16T00:05:00Z', url: 'https://x.n8n.cloud/webhook/a', pending_update_count: 12 },
  ]);
  assert.equal(tl.count, 2); assert.equal(tl.changes.length, 1);
  assert.ok(sparklinePath(tl.pendingValues).startsWith('M'));
});

test('exportReport is redacted: no token field, host only', () => {
  const d = diagnose({ info: { url: 'https://x.n8n.cloud/webhook/a', pending_update_count: 47, last_error_message: 'Wrong response from the webhook: 502 Bad Gateway' } }, claimants);
  const md = exportReport(d, []);
  assert.ok(md.includes('WEBHOOK — STOLEN'));
  assert.ok(md.includes('No token was used or stored'));
  assert.ok(!/\d{6,}:[A-Za-z0-9_-]{20,}/.test(md), 'no token-shaped secret in the report');
});

test('update inspector decodes a message and a callback query', () => {
  const m = inspectUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 9, type: 'private' }, text: '/start' } });
  assert.equal(m.ok, true); assert.equal(m.type, 'message'); assert.equal(m.chatId, 9);
  assert.equal(m.sendMessage.method, 'sendMessage');
  const c = inspectUpdate(JSON.stringify({ update_id: 2, callback_query: { id: 'q1', data: 'buy', message: { chat: { id: 9 } } } }));
  assert.equal(c.type, 'callback_query');
  assert.equal(inspectUpdate('nope').ok, false);
});

test('fix cards exist for all six stacks and warn about drop_pending_updates', () => {
  for (const k of ['aiogram', 'python-telegram-bot', 'telegraf', 'grammy', 'n8n', 'openclaw']) {
    assert.ok(FIXES[k], k);
    assert.ok(FIXES[k].warning.includes('drop_pending_updates'), `${k}: warning`);
    assert.ok(FIXES[k].code.length > 10, `${k}: code`);
  }
});
