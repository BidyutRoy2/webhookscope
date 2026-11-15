import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare, shareUrl, shareTooLarge } from '../src/share.js';

const state = {
  json: '{"ok":true,"result":{"url":"https://n8n.example.com/webhook/x","pending_update_count":47}}',
  fw: 'n8n',
  err409: 'Conflict: terminated by other getUpdates request — ünïcode ✓',
};

test('share codec round-trips ASCII state', () => {
  const code = encodeShare(state);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.ok(!code.includes('+') && !code.includes('/') && !code.includes('='));
  assert.deepEqual(decodeShare(code), state);
});

test('share codec is Unicode-safe', () => {
  const unicode = { json: '{"text":"héllo 🌍 ünïcode"}', fw: '', err409: '' };
  assert.deepEqual(decodeShare(encodeShare(unicode)), unicode);
});

test('share codec survives URL embedding', () => {
  const url = shareUrl('https://webhookscope.vercel.app/', state);
  assert.ok(url.startsWith('https://webhookscope.vercel.app/#d='));
  const code = url.split('#d=')[1];
  assert.deepEqual(decodeShare(code), state);
});

test('shareUrl strips an existing hash before appending', () => {
  const url = shareUrl('https://webhookscope.vercel.app/#d=oldstuff', state);
  assert.equal(url.split('#d=').length, 2);
  assert.deepEqual(decodeShare(url.split('#d=')[1]), state);
});

test('decodeShare rejects garbage', () => {
  assert.equal(decodeShare(''), null);
  assert.equal(decodeShare(null), null);
  assert.equal(decodeShare('not!base64'), null);
  // Empty json round-trips as an empty state (still a valid v:1 payload).
  assert.deepEqual(decodeShare(encodeShare({ json: '' })), { json: '', fw: '', err409: '' });
});

test('decodeShare rejects wrong version and wrong shape', () => {
  const wrongVersion = Buffer.from(JSON.stringify({ v: 2, json: '{}' })).toString('base64url');
  assert.equal(decodeShare(wrongVersion), null);
  const noJson = Buffer.from(JSON.stringify({ v: 1 })).toString('base64url');
  assert.equal(decodeShare(noJson), null);
  const notJson = Buffer.from('hello').toString('base64url');
  assert.equal(decodeShare(notJson), null);
});

test('shareTooLarge guards the ~50 KB limit', () => {
  assert.equal(shareTooLarge('x'.repeat(100)), false);
  assert.equal(shareTooLarge('x'.repeat(51 * 1024)), true);
  // Multi-byte chars count as bytes, not characters.
  assert.equal(shareTooLarge('✓'.repeat(20000)), true); // 3 bytes each = 60 KB
  assert.equal(shareTooLarge('✓'.repeat(10000)), false); // 30 KB
});
