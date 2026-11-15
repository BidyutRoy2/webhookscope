import { parseWebhookInfo, diagnose, fingerprintUrl, buildTimeline, sparklinePath, exportReport } from '../../src/autopsy.js';
import { FIXES } from '../../src/fixes.js';
import { inspectUpdate } from '../../src/update-inspector.js';
import { decodeShare, shareUrl, shareTooLarge } from '../../src/share.js';
import { locateJsonError } from '../../src/json-error.js';

const FALLBACK_CLAIMANTS = { patterns: [
  { id: 'n8n', label: 'n8n workflow (Telegram Trigger)', kind: 'automation', confidence: 'high', hostPatterns: ['\\.n8n\\.cloud$', 'n8n'], pathPatterns: ['/webhook/', '/webhook-test/'], verify: 'Check n8n → Workflows → Telegram Trigger credential.', fix: 'Give n8n its own bot via BotFather → /newbot.' },
  { id: 'ngrok', label: 'ngrok tunnel (someone\'s local machine)', kind: 'tunnel', confidence: 'high', hostPatterns: ['\\.ngrok\\.io$', '\\.ngrok-free\\.app$'], pathPatterns: [], verify: 'Check for a running ngrok process.', fix: 'Kill the stale tunnel.' },
  { id: 'unknown', label: 'Unknown host — check this host', kind: 'unknown', confidence: 'low', hostPatterns: [], pathPatterns: [], verify: 'Check every deploy and automation service.', fix: 'If unrecognised, delete the webhook.' },
]};

let CLAIMANTS = FALLBACK_CLAIMANTS;
try {
  const r = await fetch('data/claimants.json');
  if (r.ok) CLAIMANTS = await r.json();
} catch { /* file:// or offline: fallback patterns above */ }

const $ = (id) => document.getElementById(id);
const DEMO_JSON = JSON.stringify({ ok: true, result: {
  url: 'https://n8n.example.com/webhook/3f9a1c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b/telegram',
  has_custom_certificate: false, pending_update_count: 47, ip_address: '203.0.113.42',
  last_error_date: 1762995600, last_error_message: 'Wrong response from the webhook: 502 Bad Gateway',
  max_connections: 40, allowed_updates: ['message', 'callback_query'],
} }, null, 2);
const DEMO_GETME = JSON.stringify({ ok: true, result: { id: 987654321, is_bot: true, first_name: 'Demo Bot', username: 'demo_bot', can_read_all_group_messages: false } }, null, 2);

// Sample presets — verbatim copies of examples/*.json, embedded inline so
// they work on file:// too (no fetch). The 409 preset also sets the err409 field.
const PRESET_HEALTHY = "{\n  \"ok\": true,\n  \"result\": {\n    \"url\": \"https://bot.example.com/webhook/telegram\",\n    \"has_custom_certificate\": false,\n    \"pending_update_count\": 0,\n    \"ip_address\": \"203.0.113.10\",\n    \"max_connections\": 40\n  }\n}";
const PRESET_POLLER = "{\n  \"ok\": true,\n  \"result\": {\n    \"url\": \"\",\n    \"has_custom_certificate\": false,\n    \"pending_update_count\": 0,\n    \"max_connections\": 40\n  }\n}";
const PRESET_STALE = "{\n  \"ok\": true,\n  \"result\": {\n    \"url\": \"https://bot.example.com/webhook/telegram\",\n    \"has_custom_certificate\": false,\n    \"pending_update_count\": 12,\n    \"ip_address\": \"203.0.113.10\",\n    \"last_error_date\": 1762995600,\n    \"last_error_message\": \"Wrong response from the webhook: 502 Bad Gateway\",\n    \"max_connections\": 40\n  }\n}";
const PRESETS = {
  healthy: { json: PRESET_HEALTHY, err409: '' },
  poller: { json: PRESET_POLLER, err409: 'Conflict: terminated by other getUpdates request' },
  stale: { json: PRESET_STALE, err409: '' },
};

let lastDiagnosis = null;
let lastSamples = [];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// --- Clipboard with fallback (file:// and older browsers) ---
async function copyText(text, btn) {
  const original = btn.textContent;
  const done = (label) => {
    btn.textContent = label;
    setTimeout(() => { btn.textContent = original; }, 2000);
  };
  try {
    await navigator.clipboard.writeText(text);
    done('Copied ✓');
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done('Copied ✓');
      return true;
    } catch {
      done('Copy failed — select manually');
      return false;
    }
  }
}

function storeKey() { return 'webhookscope:autopsy:timeline'; }
function loadSamples() { try { return JSON.parse(localStorage.getItem(storeKey()) || '[]'); } catch { return []; } }
function saveSample(info) {
  const samples = loadSamples();
  const last = samples[samples.length - 1];
  if (last && last.url === (info.url || '') && last.pending_update_count === (info.pending_update_count || 0)) return samples;
  samples.push({ sampledAt: new Date().toISOString(), url: info.url || '', pending_update_count: info.pending_update_count || 0 });
  const kept = samples.slice(-50);
  try { localStorage.setItem(storeKey(), JSON.stringify(kept)); } catch {}
  return kept;
}

// --- Recent history (localStorage only, max 5; getWebhookInfo has no secret) ---
const HISTORY_KEY = 'webhookscope:autopsy:history';
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveHistory(list) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5))); } catch {} }
function addHistory(d, raw) {
  let host = '(polling)';
  try { if (d.url) host = new URL(d.url).hostname; } catch { host = d.url || '(polling)'; }
  const list = loadHistory().filter((h) => h.json !== raw);
  list.unshift({ json: raw, label: d.label, host, time: new Date().toISOString() });
  saveHistory(list);
  renderHistory();
}
function renderHistory() {
  const box = $('historyBox');
  const list = loadHistory();
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="card"><h3>Recent — local only</h3><div class="history">${list.map((h, i) => `<span class="hwrap"><button class="ghost mini" data-h="${i}">${esc(h.label)} · ${esc(h.host)} · ${esc(new Date(h.time).toLocaleString())}</button><button class="ghost mini hx" data-hx="${i}" aria-label="Delete this entry">✕</button></span>`).join('')}<button class="ghost mini" id="histClearAll">Clear all</button></div></div>`;
  box.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => {
    const h = loadHistory()[Number(b.dataset.h)];
    if (!h) return;
    $('jsonInput').value = h.json; fitJson(); updateShareState(); runAutopsy();
  }));
  box.querySelectorAll('[data-hx]').forEach((b) => b.addEventListener('click', () => {
    const list2 = loadHistory(); list2.splice(Number(b.dataset.hx), 1); saveHistory(list2); renderHistory();
  }));
  $('histClearAll').addEventListener('click', () => { saveHistory([]); renderHistory(); });
}

function renderTimeline() {
  const box = $('timelineBox');
  const samples = loadSamples();
  const tl = buildTimeline(samples);
  if (tl.count === 0) { box.innerHTML = '<div class="card"><h3>Claim timeline</h3><p style="color:var(--mut)">No samples yet. Click “Sample again” after a deploy — the timeline is built by sampling forward. Past claim times cannot be reconstructed from Telegram\'s API alone; the timeline shows a window, never an invented timestamp.</p></div>'; return; }
  const path = sparklinePath(tl.pendingValues);
  const changes = tl.changes.length ? tl.changes.map((c) => `<li>URL changed between ${esc(c.from)} and ${esc(c.to)}: ${esc(c.fromUrl)} → ${esc(c.toUrl)}</li>`).join('') : '<li>No URL changes in the sampled window.</li>';
  box.innerHTML = `<div class="card"><h3>Claim timeline — ${tl.count} sample(s), local only</h3>
  <p style="color:var(--mut)">First seen ${esc(tl.firstSeen || '')} · last seen ${esc(tl.lastSeen || '')}</p>
  <svg width="220" height="36" viewBox="0 0 220 36" role="img" aria-label="pending_update_count sparkline"><path d="${path}" fill="none" stroke="#34f5a5" stroke-width="2"/></svg>
  <p style="color:var(--mut)">pending_update_count over samples (latest: ${tl.pendingValues[tl.pendingValues.length - 1]})</p>
  <ul>${changes}</ul></div>`;
}

function renderFix(framework, diagnosis) {
  const f = FIXES[framework] || FIXES.aiogram;
  const fp = diagnosis && diagnosis.fingerprint && diagnosis.fingerprint.id !== 'unknown' ? diagnosis.fingerprint : null;
  const fpFix = fp && fp.fix ? `<p><b>Fingerprint fix:</b> ${esc(fp.fix)}</p>` : '';
  $('fixBox').innerHTML = `<div class="fixcard"><h3>Fix — ${esc(f.label)}</h3>
  <ol>${f.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  <pre>${esc(f.code)}</pre>
  <p class="warning">⚠ ${esc(f.warning)}</p><p>${esc(f.extra)}</p>${fpFix}
  <button class="ghost" data-copy="${esc(f.code)}">Copy fix</button></div>`;
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.getAttribute('data-copy')); b.textContent = 'Copied ✓'; } catch { b.textContent = 'Copy failed — select the code manually'; }
  }));
}

function radarSVG(cls) {
  const color = cls === 'stolen' ? '#ff4d5e' : cls === 'healthy' ? '#34f5a5' : cls === 'failing' ? '#ffb020' : '#9fb8ad';
  return `<svg class="radarviz" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Verdict radar"><circle cx="60" cy="60" r="54" fill="none" stroke="#43707a"/><circle cx="60" cy="60" r="36" fill="none" stroke="#43707a"/><circle cx="60" cy="60" r="18" fill="none" stroke="#43707a"/><line x1="60" y1="60" x2="102" y2="30" stroke="${color}" stroke-width="2"/><circle cx="88" cy="42" r="6" fill="${color}"/><circle cx="60" cy="60" r="3" fill="${color}"/></svg>`;
}

function renderDiagnosis(d) {
  lastDiagnosis = d;
  const cls = d.verdict.includes('STOLEN') ? 'stolen' : d.verdict.includes('HEALTHY') ? 'healthy' : d.verdict === 'INVALID' ? '' : 'failing';
  const verdictText = `${d.label} (${d.confidence} confidence) — ${d.summary}`;
  $('verdictBox').className = `verdict ${cls}`;
  $('verdictBox').innerHTML = `${radarSVG(cls)}<strong>${esc(d.label)}</strong><span class="conf">${esc(d.confidence)} confidence</span><p>${esc(d.summary)}</p><button class="ghost mini" id="copyVerdictBtn">Copy verdict</button>`;
  $('copyVerdictBtn').addEventListener('click', async (e) => { await copyText(verdictText, e.currentTarget); });
  $('heroVerdict').textContent = `Latest result — ${d.label} · ${d.confidence} confidence${d.fingerprint ? ` · ${d.fingerprint.label}` : ''}`;
  $('fingerprintBox').innerHTML = d.fingerprint && d.url ? `<div class="card"><h3>Claimant fingerprint</h3>
    <p><b>${esc(d.fingerprint.label)}</b> <span class="pill ${d.fingerprint.confidence === 'high' ? 'hot' : ''}">${esc(d.fingerprint.confidence)} confidence</span></p>
    <p style="color:var(--mut)">${esc(d.fingerprint.pattern || d.fingerprint.evidence || '')}</p>
    <p><b>How to verify:</b> ${esc(d.fingerprint.verify || '')}</p>
    <p style="color:var(--mut)">Fingerprinting is probabilistic — Telegram publishes no “who set this webhook” API. Unknown hosts stay Unknown.</p></div>` : '';
  $('notesBox').innerHTML = d.notes.length ? `<div class="card"><h3>Notes</h3><ul>${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : '';
  $('notesBox').innerHTML += `<div class="card"><h3>Evidence (exact fields)</h3><ul class="evidence">${d.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
  renderTimeline();
  renderFix($('fwSelect').value, d);
}

function showParseError(text, loc) {
  const errEl = $('parseError');
  const jumpBtn = $('jumpErrBtn');
  errEl.textContent = text;
  errEl.hidden = false;
  $('jsonInput').setAttribute('aria-invalid', 'true');
  if (loc) {
    jumpBtn.hidden = false;
    jumpBtn.onclick = () => {
      const t = $('jsonInput');
      t.focus();
      try { t.setSelectionRange(loc.position, loc.position + 1); } catch {}
    };
  } else {
    jumpBtn.hidden = true;
  }
}

function clearParseError() {
  $('parseError').hidden = true;
  $('jumpErrBtn').hidden = true;
  $('jsonInput').removeAttribute('aria-invalid');
}

function runAutopsy({ focus = true } = {}) {
  const raw = $('jsonInput').value;
  clearParseError();
  const trimmed = raw.trim();
  if (!trimmed) { showParseError('Empty input — paste the getWebhookInfo JSON first.'); return; }
  const loc = locateJsonError(raw);
  if (loc) {
    // Syntax error — pinpoint it, never clear the pasted JSON.
    showParseError(`Line ${loc.line}, column ${loc.column}: ${loc.message}`, loc);
    return;
  }
  const { info, getMe, error } = parseWebhookInfo(raw);
  if (error || !info) {
    if (error && error.includes('does not look like getWebhookInfo')) {
      showParseError("Valid JSON — but this doesn't look like getWebhookInfo output: missing url/pending_update_count. Did you paste the right endpoint?");
    } else {
      showParseError(error || 'Could not parse that JSON.');
    }
    return;
  }
  const d = diagnose({ info, getMe, error409: $('err409').value }, CLAIMANTS);
  lastSamples = saveSample(info);
  renderDiagnosis(d);
  addHistory(d, raw);
  updateShareState();
  if (focus) $('verdictBox').focus();
}

// --- Share link (URL fragment only — never sent to any server) ---
function updateShareState() {
  const raw = $('jsonInput').value;
  const tooBig = shareTooLarge(raw);
  $('shareBtn').disabled = tooBig;
  $('shareNote').textContent = tooBig
    ? 'Too large to share by link — use Export report instead.'
    : 'The link lives in the URL fragment — it is never sent to any server.';
}

$('runBtn').addEventListener('click', () => runAutopsy());
$('demoBtn').addEventListener('click', () => { $('jsonInput').value = DEMO_JSON; fitJson(); updateShareState(); runAutopsy(); });
$('demoBtnTop').addEventListener('click', () => { $('jsonInput').value = DEMO_JSON; fitJson(); updateShareState(); document.getElementById('autopsy').scrollIntoView(); runAutopsy(); });
$('clearBtn').addEventListener('click', () => {
  $('jsonInput').value = DEMO_JSON; fitJson(); $('err409').value = '';
  clearParseError();
  $('verdictBox').className = 'verdict';
  $('verdictBox').innerHTML = '<strong>Verdict radar — waiting.</strong><br><span style="color:var(--mut)">Paste JSON and click “Autopsy my bot”, or load the demo. The demo runs automatically on first load.</span>';
  $('fingerprintBox').innerHTML = ''; $('notesBox').innerHTML = ''; $('fixBox').innerHTML = '';
  $('heroVerdict').textContent = 'Latest result — cleared. Click “Autopsy my bot” to run the demo again.';
  try { localStorage.removeItem(storeKey()); } catch {}
  lastDiagnosis = null; lastSamples = [];
  renderTimeline();
  updateShareState();
  $('jsonInput').focus();
});
$('sampleBtn').addEventListener('click', () => { if ($('jsonInput').value.trim()) runAutopsy(); else { $('jsonInput').value = DEMO_JSON; fitJson(); updateShareState(); runAutopsy(); } });
$('fwSelect').addEventListener('change', () => { if (lastDiagnosis) renderFix($('fwSelect').value, lastDiagnosis); });
$('exportBtn').addEventListener('click', () => {
  if (!lastDiagnosis) { const errEl = $('parseError'); errEl.textContent = 'Run the autopsy first — there is no diagnosis to export yet.'; errEl.hidden = false; $('jumpErrBtn').hidden = true; return; }
  const md = exportReport(lastDiagnosis, loadSamples());
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'webhookscope-autopsy.md'; a.click(); URL.revokeObjectURL(a.href);
});
$('copyJsonBtn').addEventListener('click', async (e) => {
  let text = $('jsonInput').value;
  try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* copy the raw text as-is */ }
  await copyText(text, e.currentTarget);
});
$('shareBtn').addEventListener('click', async (e) => {
  const url = shareUrl(location.href, { json: $('jsonInput').value, fw: $('fwSelect').value, err409: $('err409').value });
  await copyText(url, e.currentTarget);
});
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  if (!p) return;
  $('jsonInput').value = p.json;
  $('err409').value = p.err409 || '';
  fitJson(); updateShareState(); runAutopsy();
}));
$('jsonInput').addEventListener('input', () => { updateShareState(); });
$('jsonInput').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runAutopsy(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); const d = $('shortcutsBox'); d.open = !d.open; }
});
$('clearDataBtn').addEventListener('click', () => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('webhookscope:')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  renderTimeline();
  renderHistory();
  $('clearDataMsg').textContent = `Cleared ${keys.length} stored item(s) from this browser.`;
});
$('liveBtn').addEventListener('click', async () => {
  const token = $('tokenInput').value.trim();
  const msg = $('liveMsg');
  if (!token) { msg.textContent = 'Paste a token first — or use JSON-paste, which needs no token at all.'; return; }
  msg.textContent = 'Checking from your browser only…';
  try {
    const [me, info] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()),
      fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()),
    ]);
    $('tokenInput').value = '';
    if (info && info.ok === false) { msg.textContent = `Telegram said: ${info.description || 'error'}. The token may be wrong or revoked.`; return; }
    $('jsonInput').value = JSON.stringify(info, null, 2);
    fitJson();
    const { info: parsed, getMe } = parseWebhookInfo(info, me);
    if (parsed) { const d = diagnose({ info: parsed, getMe }, CLAIMANTS); lastSamples = saveSample(parsed); renderDiagnosis(d); msg.textContent = 'Done. Token was never sent to WebhookScope and the field is now cleared. Consider revoking it in BotFather (/revoke) after this check.'; }
  } catch { msg.textContent = 'The browser could not reach api.telegram.org (network / CORS block). Use JSON-paste instead — it gives the full verdict with no token.'; $('tokenInput').value = ''; }
});

// --- Flow lesson ---
const LESSONS = {
  polling: [
    ['0.000s', 'User', 'Telegram', 'User sends /start'],
    ['0.012s', 'Your bot', 'Telegram', 'getUpdates — long poll opens (timeout 30s)'],
    ['0.410s', 'Telegram', 'Your bot', 'Update #10000 delivered: message /start'],
    ['0.430s', 'Your bot', 'Telegram', 'sendMessage — reply sent'],
    ['0.445s', 'Telegram', 'User', 'User sees the reply'],
  ],
  webhook: [
    ['0.000s', 'User', 'Telegram', 'User sends /start'],
    ['0.010s', 'Telegram', 'Your bot', 'POST /webhook — Update #10000 (JSON)'],
    ['0.030s', 'Your bot', 'Telegram', '200 OK in <60s — delivery confirmed'],
    ['0.045s', 'Your bot', 'Telegram', 'sendMessage — reply sent'],
    ['0.060s', 'Telegram', 'User', 'User sees the reply'],
  ],
};
let lessonIdx = 0, lessonTimer = null;
function lessonMode() { return document.querySelector('input[name="mode"]:checked').value; }
function renderLesson() {
  const rows = LESSONS[lessonMode()].slice(0, lessonIdx);
  $('flowBody').innerHTML = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('') : '<tr><td colspan="5" style="color:var(--mut)">No updates on the wire yet.</td></tr>';
  $('stepText').textContent = `Step ${lessonIdx}/5 — ${lessonMode() === 'polling' ? 'long polling (getUpdates)' : 'webhook (POST)'}${lessonIdx === 5 ? ' — done. The update arrived and the reply went out.' : ''}`;
  document.querySelectorAll('#diagram .node').forEach((n, i) => n.classList.toggle('active', lessonIdx > 0 && i === Math.min(lessonIdx - 1, 3)));
}
function lessonStep() { if (lessonIdx < 5) { lessonIdx++; renderLesson(); if (lessonIdx >= 5) { clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; } } else { clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; } }
$('stepBtn').addEventListener('click', lessonStep);
$('resetBtn').addEventListener('click', () => { lessonIdx = 0; clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; renderLesson(); });
$('playBtn').addEventListener('click', () => { if (lessonTimer) { clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; return; } if (lessonIdx >= 5) lessonIdx = 0; lessonTimer = setInterval(lessonStep, 900); $('playBtn').textContent = '⏸ Pause'; });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => { lessonIdx = 0; clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; renderLesson(); }));

// --- Failure playground ---
const PLAY_FAULTS = [
  { id: 'tgSlow', label: 'slow handler (timeout)', verdict: 'WEBHOOK — failing deliveries (timeout)', pending: 23, state: 'stSlow' },
  { id: 'tg500', label: 'handler 500', verdict: 'WEBHOOK — failing deliveries (500)', pending: 8, state: 'st500' },
  { id: 'tgWebhook', label: 'webhook stolen (n8n)', verdict: 'WEBHOOK — STOLEN (n8n)', pending: 47, state: 'stWebhook' },
  { id: 'tgSecond', label: 'second poller (409)', verdict: 'SECOND POLLER suspected (409)', pending: 12, state: 'stSecond' },
];
function renderPlayground() {
  const active = PLAY_FAULTS.filter((f) => $(f.id).checked);
  const pending = active.reduce((n, f) => n + f.pending, 0);
  $('playResult').textContent = active.length === 0
    ? 'Simulated pending_update_count: 0 · verdict: POLLING — healthy'
    : `Simulated pending_update_count: ${pending} · verdict: ${active[0].verdict} — active faults: ${active.map((f) => f.label).join(' · ')}`;
  for (const f of PLAY_FAULTS) {
    const el = $(f.state);
    const on = $(f.id).checked;
    el.textContent = on ? 'On' : 'Off';
    el.classList.toggle('on', on);
  }
}
['tgSecond', 'tgWebhook', 'tg500', 'tgSlow'].forEach((id) => $(id).addEventListener('change', renderPlayground));

// --- Update inspector ---
$('inspectBtn').addEventListener('click', () => {
  const r = inspectUpdate($('updInput').value);
  if (!r.ok) { $('inspectOut').innerHTML = `<p class="danger">${esc(r.error)}</p>`; return; }
  $('inspectOut').innerHTML = `<div class="card"><h3>Update #${r.updateId} — type: <code>${esc(r.type)}</code></h3>
  <p><b>Handler:</b> ${esc(r.handler)}</p>
  ${r.sendMessage ? `<p><b>Should produce:</b></p><pre>${esc(JSON.stringify(r.sendMessage, null, 2))}</pre>` : '<p>No chat to reply to in this Update.</p>'}
  <ul class="evidence">${r.tree.map((t) => `<li>${esc(t.key)} = ${esc(t.value)}</li>`).join('')}</ul></div>`;
});
$('copyInspectBtn').addEventListener('click', async (e) => {
  const out = $('inspectOut').innerText.trim();
  if (!out) {
    const original = e.currentTarget.textContent;
    e.currentTarget.textContent = 'Nothing to copy yet';
    setTimeout(() => { e.currentTarget.textContent = original; }, 2000);
    return;
  }
  await copyText(out, e.currentTarget);
});

function fitJson() { const t = $('jsonInput'); t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
$('jsonInput').addEventListener('input', fitJson);

// Init: a shared #d= link wins over the demo; otherwise demo pre-filled + auto-run.
let sharedState = null;
if (location.hash.startsWith('#d=')) sharedState = decodeShare(location.hash.slice(3));
if (sharedState) {
  $('jsonInput').value = sharedState.json;
  if (sharedState.fw) $('fwSelect').value = sharedState.fw;
  $('err409').value = sharedState.err409 || '';
} else {
  $('jsonInput').value = DEMO_JSON;
}
fitJson();
updateShareState();
renderLesson(); renderPlayground(); renderTimeline(); renderHistory();
runAutopsy({ focus: false });
