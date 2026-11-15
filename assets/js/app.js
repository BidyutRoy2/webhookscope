import { parseWebhookInfo, diagnose, fingerprintUrl, buildTimeline, sparklinePath, exportReport } from '../../src/autopsy.js';
import { FIXES } from '../../src/fixes.js';
import { inspectUpdate } from '../../src/update-inspector.js';

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

let lastDiagnosis = null;
let lastSamples = [];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function storeKey() { return 'webhookscope:autopsy:timeline'; }
function loadSamples() { try { return JSON.parse(localStorage.getItem(storeKey()) || '[]'); } catch { return []; } }
function saveSample(info) {
  const samples = loadSamples();
  samples.push({ sampledAt: new Date().toISOString(), url: info.url || '', pending_update_count: info.pending_update_count || 0 });
  const kept = samples.slice(-50);
  try { localStorage.setItem(storeKey(), JSON.stringify(kept)); } catch {}
  return kept;
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

function runAutopsy(prefillDemo = false) {
  const raw = $('jsonInput').value.trim();
  const errEl = $('parseError');
  errEl.hidden = true;
  const { info, getMe, error } = parseWebhookInfo(raw);
  if (error || !info) { errEl.textContent = error || 'Could not parse that JSON.'; errEl.hidden = false; return; }
  const d = diagnose({ info, getMe, error409: $('err409').value }, CLAIMANTS);
  lastDiagnosis = d;
  lastSamples = saveSample(info);
  const cls = d.verdict.includes('STOLEN') ? 'stolen' : d.verdict.includes('HEALTHY') ? 'healthy' : d.verdict === 'INVALID' ? '' : 'failing';
  $('verdictBox').className = `verdict ${cls}`;
  $('verdictBox').innerHTML = `<strong>${esc(d.label)}</strong><span class="conf">${esc(d.confidence)} confidence</span><p>${esc(d.summary)}</p>`;
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

$('runBtn').addEventListener('click', () => runAutopsy());
$('demoBtn').addEventListener('click', () => { $('jsonInput').value = DEMO_JSON; runAutopsy(); });
$('demoBtnTop').addEventListener('click', () => { $('jsonInput').value = DEMO_JSON; document.getElementById('autopsy').scrollIntoView(); runAutopsy(); });
$('clearBtn').addEventListener('click', () => { $('jsonInput').value = ''; $('err409').value = ''; $('verdictBox').innerHTML = '<strong>Verdict radar — waiting.</strong>'; $('fingerprintBox').innerHTML = ''; $('notesBox').innerHTML = ''; $('fixBox').innerHTML = ''; });
$('sampleBtn').addEventListener('click', () => { if ($('jsonInput').value.trim()) runAutopsy(); else { $('jsonInput').value = DEMO_JSON; runAutopsy(); } });
$('fwSelect').addEventListener('change', () => { if (lastDiagnosis) renderFix($('fwSelect').value, lastDiagnosis); });
$('exportBtn').addEventListener('click', () => {
  if (!lastDiagnosis) return;
  const md = exportReport(lastDiagnosis, loadSamples());
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'webhookscope-autopsy.md'; a.click(); URL.revokeObjectURL(a.href);
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
    const { info: parsed, getMe } = parseWebhookInfo(info, me);
    if (parsed) { const d = diagnose({ info: parsed, getMe }, CLAIMANTS); lastDiagnosis = d; lastSamples = saveSample(parsed); msg.textContent = 'Done. Token was never sent to WebhookScope and the field is now cleared. Consider revoking it in BotFather (/revoke) after this check.'; renderTimeline(); renderFix($('fwSelect').value, d);
      $('verdictBox').className = `verdict ${d.verdict.includes('STOLEN') ? 'stolen' : d.verdict.includes('HEALTHY') ? 'healthy' : 'failing'}`;
      $('verdictBox').innerHTML = `<strong>${esc(d.label)}</strong><span class="conf">${esc(d.confidence)} confidence</span><p>${esc(d.summary)}</p>`;
    }
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
function lessonStep() { if (lessonIdx < 5) { lessonIdx++; renderLesson(); } else { clearInterval(lessonTimer); lessonTimer = null; } }
$('stepBtn').addEventListener('click', lessonStep);
$('resetBtn').addEventListener('click', () => { lessonIdx = 0; clearInterval(lessonTimer); lessonTimer = null; renderLesson(); });
$('playBtn').addEventListener('click', () => { if (lessonTimer) { clearInterval(lessonTimer); lessonTimer = null; $('playBtn').textContent = '▶ Play'; return; } if (lessonIdx >= 5) lessonIdx = 0; lessonTimer = setInterval(lessonStep, 900); $('playBtn').textContent = '⏸ Pause'; });
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => { lessonIdx = 0; renderLesson(); }));

// --- Failure playground ---
function renderPlayground() {
  let pending = 0; let verdict = 'POLLING — healthy';
  if ($('tgSecond').checked) { pending += 12; verdict = 'SECOND POLLER suspected (409)'; }
  if ($('tgWebhook').checked) { pending += 47; verdict = 'WEBHOOK — STOLEN (n8n)'; }
  if ($('tg500').checked) { pending += 8; verdict = 'WEBHOOK — failing deliveries (500)'; }
  if ($('tgSlow').checked) { pending += 23; verdict = 'WEBHOOK — failing deliveries (timeout)'; }
  $('playResult').textContent = `Simulated pending_update_count: ${pending} · verdict: ${verdict}`;
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

// Init: demo pre-filled + auto-run (fixes the reference's cold-start flaw).
$('jsonInput').value = DEMO_JSON;
renderLesson(); renderPlayground(); renderTimeline();
runAutopsy();
