// WebhookScope — Silent Bot Autopsy verdict engine (pure, no DOM).
// Shared by the browser UI and the Node test suite. No token is ever
// read, stored or sent by this module: it only analyses getWebhookInfo
// JSON (which contains no secret) and pasted 409 error lines.
export const VERDICTS = {
  POLLING_HEALTHY: 'POLLING_HEALTHY',
  WEBHOOK_HEALTHY: 'WEBHOOK_HEALTHY',
  WEBHOOK_FAILING: 'WEBHOOK_FAILING',
  WEBHOOK_STOLEN: 'WEBHOOK_STOLEN',
  SECOND_POLLER_SUSPECTED: 'SECOND_POLLER_SUSPECTED',
  INVALID: 'INVALID',
};

export const VERDICT_LABELS = {
  POLLING_HEALTHY: 'POLLING — healthy',
  WEBHOOK_HEALTHY: 'WEBHOOK — healthy',
  WEBHOOK_FAILING: 'WEBHOOK — failing deliveries',
  WEBHOOK_STOLEN: 'WEBHOOK — STOLEN: claimed by another consumer',
  SECOND_POLLER_SUSPECTED: 'SECOND POLLER suspected',
  INVALID: 'Cannot diagnose — bad input',
};

const CONF_RANK = { high: 3, medium: 2, low: 1 };

export function classify409(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  if (t.includes('terminated by other getupdates')) return 'other-getupdates';
  if (t.includes("can't use getupdates") || t.includes('cant use getupdates')) return 'webhook-active';
  if (t.includes('terminated by setwebhook')) return 'setwebhook';
  if (t.includes('409')) return 'conflict-unknown';
  return null;
}

export function fingerprintUrl(url, claimants) {
  const fallback = {
    id: 'unknown', label: 'Unknown host — check this host', kind: 'unknown',
    confidence: 'low', pattern: 'no known pattern matched', evidence: 'No known host/path pattern matched this URL.',
    verify: 'Check every deploy, tunnel and automation service that could hold this bot token.',
    fix: 'If you do not recognise this URL, delete the webhook and restart your poller with a fresh check.',
  };
  if (!url || typeof url !== 'string') return fallback;
  let host = '';
  let path = '';
  try { const u = new URL(url); host = u.hostname; path = u.pathname; } catch { return fallback; }
  const list = (claimants && claimants.patterns) || claimants || [];
  let best = null;
  let bestScore = 0;
  for (const p of list) {
    let hostScore = 0;
    let pathScore = 0;
    let matched = [];
    for (const hp of (p.hostPatterns || [])) {
      try { if (new RegExp(hp, 'i').test(host)) { hostScore += 2; matched.push(`host matches ${hp}`); } } catch {}
    }
    // A path pattern alone never fingerprints anyone: /webhook is generic.
    // Path matches only boost a host match.
    if (hostScore > 0) {
      for (const pp of (p.pathPatterns || [])) {
        try { if (new RegExp(pp, 'i').test(path)) { pathScore += 1; matched.push(`path matches ${pp}`); } } catch {}
      }
    }
    const score = hostScore + pathScore;
    if (score > bestScore) { bestScore = score; best = { ...p, pattern: matched.join('; ') }; }
  }
  if (!best) return fallback;
  if (bestScore < 2) return fallback;
  return best;
}

// Accepts: raw WebhookInfo, {ok:true,result:{...}}, {result:{...}}, or a
// JSON string. Returns {info, getMe, error} — never throws on bad input.
export function parseWebhookInfo(raw, getMeRaw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return { info: null, getMe: null, error: 'That is not valid JSON. Paste the raw output of getWebhookInfo.' }; }
  }
  if (!obj || typeof obj !== 'object') return { info: null, getMe: null, error: 'Empty input. Paste the raw output of getWebhookInfo.' };
  let info = obj;
  if (obj.result && typeof obj.result === 'object') info = obj.result;
  if (obj.ok === false) return { info: null, getMe: null, error: `Telegram returned an error: ${obj.description || 'unknown error'}. Check the token / URL and try again.` };
  if (typeof info.url !== 'string' && typeof info.pending_update_count === 'undefined') {
    return { info: null, getMe: null, error: 'This JSON does not look like getWebhookInfo output (no url / pending_update_count field).' };
  }
  let getMe = null;
  if (getMeRaw) {
    try { const g = typeof getMeRaw === 'string' ? JSON.parse(getMeRaw) : getMeRaw; getMe = g.result || g; } catch { getMe = null; }
  }
  return { info, getMe, error: null };
}

export function diagnose(input, claimants) {
  const { info, getMe = null, error409 = '' } = input || {};
  if (!info || typeof info !== 'object') {
    return { verdict: VERDICTS.INVALID, label: VERDICT_LABELS.INVALID, confidence: 'low', summary: 'No getWebhookInfo data to diagnose.', evidence: [], fingerprint: null, notes: [], variant: null };
  }
  const url = typeof info.url === 'string' ? info.url : '';
  const pending = Number(info.pending_update_count || 0);
  const lastError = info.last_error_message || '';
  const lastErrorDate = info.last_error_date || null;
  const ip = info.ip_address || '';
  const maxConn = info.max_connections;
  const allowed = info.allowed_updates;
  const variant = classify409(error409);
  const fp = url ? fingerprintUrl(url, claimants) : null;
  const evidence = [];
  const notes = [];
  if (url) evidence.push(`url = ${url}`);
  else evidence.push('url is empty — no webhook is set, so the bot is polling (or nothing is collecting updates)');
  evidence.push(`pending_update_count = ${pending}`);
  if (lastError) evidence.push(`last_error_message = "${lastError}"${lastErrorDate ? ` (last_error_date = ${new Date(lastErrorDate * 1000).toISOString()})` : ''}`);
  if (ip) evidence.push(`ip_address = ${ip}`);
  if (typeof maxConn !== 'undefined') evidence.push(`max_connections = ${maxConn}`);
  if (Array.isArray(allowed)) evidence.push(`allowed_updates = [${allowed.join(', ')}]`);
  if (fp && url) evidence.push(`fingerprint: ${fp.label} (${fp.confidence} confidence — ${fp.pattern || fp.evidence})`);
  if (variant) evidence.push(`409 variant: ${variant}`);

  if (maxConn === 1) notes.push('max_connections is 1 — often left over from debugging; a slow handler can queue everything behind one connection.');
  if (Array.isArray(allowed) && allowed.length > 0) {
    const missing = ['message', 'callback_query', 'edited_message', 'channel_post', 'my_chat_member'].filter((t) => !allowed.includes(t));
    if (missing.length) notes.push(`allowed_updates restricts delivery to [${allowed.join(', ')}] — ${missing.join(', ')} will be dropped server-side and nothing says why.`);
  }
  if (getMe && getMe.can_read_all_group_messages === false) notes.push('Privacy mode is ON (can_read_all_group_messages = false): the bot will stay silent in groups unless it is an admin or privacy mode is off in BotFather.');
  if (pending > 0) notes.push(`Telegram is holding ${pending} undelivered update(s) for up to 24 hours. They are not lost yet — but nothing is collecting them.`);

  let verdict; let confidence = 'medium'; let summary;
  if (variant === 'other-getupdates') {
    verdict = VERDICTS.SECOND_POLLER_SUSPECTED;
    confidence = 'high';
    summary = 'Another getUpdates poller is running on this token and Telegram terminated this one. Find and stop the duplicate — a restart alone will not fix it.';
  } else if (!url) {
    if (variant === 'webhook-active') {
      verdict = VERDICTS.SECOND_POLLER_SUSPECTED;
      confidence = 'low';
      summary = 'The 409 says a webhook is active, but this snapshot shows no webhook URL. Re-sample: the snapshot may be stale, or the webhook was just deleted.';
      notes.push('Conflicting signals — do not delete anything on this verdict alone. Sample again in a minute.');
    } else {
      verdict = VERDICTS.POLLING_HEALTHY;
      confidence = pending > 0 ? 'medium' : 'high';
      summary = 'No webhook is set, so the bot is polling. If it is still silent, the poller itself is not running — check the process, not Telegram.';
    }
  } else if (variant === 'setwebhook') {
    verdict = VERDICTS.WEBHOOK_STOLEN;
    confidence = fp && fp.kind === 'automation' ? 'high' : 'medium';
    summary = `Something just called setWebhook on this token${fp && fp.id !== 'unknown' ? ` — the URL fingerprints as ${fp.label}` : ''}. That is what killed polling.`;
  } else if (fp && (fp.kind === 'automation' || fp.kind === 'tunnel') && (pending > 0 || lastError)) {
    verdict = VERDICTS.WEBHOOK_STOLEN;
    confidence = 'high';
    summary = `This webhook is claimed by ${fp.label}, and deliveries are backing up (${pending} pending${lastError ? `, last error: "${lastError}"` : ''}). Your bot is silent because its updates are going there, not to your code.`;
  } else if (fp && fp.kind === 'automation') {
    verdict = VERDICTS.WEBHOOK_HEALTHY;
    confidence = 'medium';
    summary = `The webhook points at ${fp.label} and deliveries look healthy right now. Verify that service is yours — if it is not, it is still holding your token.`;
    notes.push('An automation service holding the token looks healthy from Telegram\'s side even when it is the wrong consumer.');
  } else if (lastError) {
    verdict = VERDICTS.WEBHOOK_FAILING;
    confidence = pending > 0 ? 'high' : 'medium';
    summary = `Telegram is trying to deliver to this webhook and failing: "${lastError}". Fix the endpoint — the bot itself is fine.`;
  } else if (pending > 0) {
    verdict = VERDICTS.WEBHOOK_FAILING;
    confidence = 'medium';
    summary = `No delivery error yet, but ${pending} update(s) are queued. The endpoint is slow or not answering fast enough.`;
  } else {
    verdict = VERDICTS.WEBHOOK_HEALTHY;
    confidence = 'high';
    summary = 'The webhook is set, deliveries are succeeding, and nothing is queued. If the bot is silent, the bug is in your handler, not in delivery.';
  }
  if (variant === 'webhook-active' && url) notes.push('Polling is blocked while this webhook is active — that is expected Telegram behaviour, not a bug. Delete the webhook first if you want to poll.');

  return { verdict, label: VERDICT_LABELS[verdict], confidence, summary, evidence, fingerprint: fp, notes, variant, pending, lastError, lastErrorDate, url };
}

export function sparklinePath(values, width = 220, height = 36) {
  if (!values || values.length === 0) return '';
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - (v / max) * (height - 8)).toFixed(1)}`);
  return `M${pts.join(' L')}`;
}

export function buildTimeline(samples) {
  const list = (samples || []).filter(Boolean);
  if (list.length === 0) return { count: 0, firstSeen: null, lastSeen: null, changes: [], pendingValues: [] };
  const changes = [];
  for (let i = 1; i < list.length; i++) {
    if (list[i].url !== list[i - 1].url) {
      changes.push({ from: list[i - 1].sampledAt, to: list[i].sampledAt, fromUrl: list[i - 1].url || '(polling)', toUrl: list[i].url || '(polling)' });
    }
  }
  return {
    count: list.length,
    firstSeen: list[0].sampledAt, lastSeen: list[list.length - 1].sampledAt,
    changes, pendingValues: list.map((s) => Number(s.pending_update_count || 0)),
  };
}

export function exportReport(diagnosis, samples) {
  const d = diagnosis;
  const lines = [
    '# WebhookScope Autopsy — redacted report', '',
    `Verdict: **${d.label}** (confidence: ${d.confidence})`, '',
    d.summary, '', '## Evidence',
    ...(d.evidence || []).map((e) => `- ${e}`),
    '', '## Fingerprint',
    d.fingerprint ? `- ${d.fingerprint.label} (${d.fingerprint.confidence} confidence — ${d.fingerprint.pattern || d.fingerprint.evidence})` : '- No webhook URL, so no fingerprint.',
    '', '## Notes',
    ...((d.notes || []).length ? d.notes.map((n) => `- ${n}`) : ['- None.']),
  ];
  if (samples && samples.length) {
    lines.push('', '## Timeline (local samples only)', `- ${samples.length} sample(s), ${samples[0].sampledAt} → ${samples[samples.length - 1].sampledAt}`);
    for (const s of samples) lines.push(`- ${s.sampledAt}: url=${s.url || '(polling)'}, pending=${s.pending_update_count || 0}`);
  }
  lines.push('', '_Generated locally by WebhookScope v0.1.2. No token was used or stored. Hostnames only — no secrets._');
  return lines.join('\n');
}

export { CONF_RANK };
