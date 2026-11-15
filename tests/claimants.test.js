import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(dir, '..', 'data', 'claimants.json'), 'utf8'));

test('claimants.json loads: versioned, every pattern has id/label/kind/confidence/verify', () => {
  assert.ok(data.version);
  assert.ok(Array.isArray(data.patterns) && data.patterns.length >= 10);
  const ids = new Set();
  for (const p of data.patterns) {
    assert.ok(p.id && !ids.has(p.id), `duplicate/missing id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.label && p.kind && ['high', 'medium', 'low'].includes(p.confidence), p.id);
    assert.ok(p.verify && p.verify.length > 10, `${p.id}: verify step`);
    assert.ok(Array.isArray(p.hostPatterns) && Array.isArray(p.pathPatterns), p.id);
    for (const re of [...p.hostPatterns, ...p.pathPatterns]) new RegExp(re, 'i'); // must compile
  }
  assert.ok(ids.has('n8n') && ids.has('ngrok') && ids.has('openclaw'));
});

test('claimants.json is honest: no pattern claims certainty above evidence', () => {
  for (const p of data.patterns) {
    assert.ok(!/100%|certain|guaranteed/i.test(p.label), p.id);
  }
});
