import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateJsonError } from '../src/json-error.js';

test('valid JSON returns null', () => {
  assert.equal(locateJsonError('{"ok":true,"result":{"url":"","pending_update_count":0}}'), null);
  assert.equal(locateJsonError('  { "a": [1, 2.5, -3e-2, true, false, null] }  '), null);
});

test('empty input points at position 0', () => {
  const e = locateJsonError('   ');
  assert.ok(e);
  assert.equal(e.position, 0);
  assert.equal(e.line, 1);
  assert.equal(e.column, 1);
});

test('missing value pinpoints the closing brace', () => {
  const e = locateJsonError('{"a": }');
  assert.ok(e);
  assert.equal(e.position, 6);
  assert.equal(e.line, 1);
  assert.equal(e.column, 7);
});

test('trailing comma pinpoints the closing brace on its line', () => {
  const raw = '{\n  "url": "x",\n  "pending": 12,\n}';
  const e = locateJsonError(raw);
  assert.ok(e);
  assert.equal(e.line, 4);
  assert.equal(e.column, 1);
  assert.match(e.message, /double-quoted property name/);
});

test('single-quoted key is flagged', () => {
  const e = locateJsonError("{'url': ''}");
  assert.ok(e);
  assert.equal(e.position, 1);
  assert.equal(e.column, 2);
  assert.match(e.message, /double-quoted property name/);
});

test('unterminated string is flagged at the opening quote', () => {
  const e = locateJsonError('{"url": "abc}');
  assert.ok(e);
  assert.equal(e.line, 1);
  assert.match(e.message, /Unterminated string/);
});

test('trailing garbage after a value is flagged', () => {
  const e = locateJsonError('{"a":1} trailing');
  assert.ok(e);
  assert.equal(e.position, 8); // the 't' — whitespace after the value is skipped first
  assert.match(e.message, /after the JSON value/);
});

test('missing colon is flagged', () => {
  const e = locateJsonError('{"a" 1}');
  assert.ok(e);
  assert.match(e.message, /Expected ':'/);
});

test('missing comma in an array is flagged', () => {
  const e = locateJsonError('[1 2]');
  assert.ok(e);
  assert.match(e.message, /Expected ',' or '\]'/);
});

test('bad escape is flagged', () => {
  const e = locateJsonError('{"a": "x\\q"}');
  assert.ok(e);
  assert.match(e.message, /Bad escape/);
});

test('line and column are computed across newlines', () => {
  const raw = '{\n  "ok": true,\n  "result": {\n    "url": "x",\n    "pending": ,\n  }\n}';
  const e = locateJsonError(raw);
  assert.ok(e);
  assert.equal(e.line, 5);
  assert.equal(e.column, 16);
});
