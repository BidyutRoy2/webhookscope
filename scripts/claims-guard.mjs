// WebhookScope — claims guard (run by CI, also runnable locally).
// Fails if index.html contains any analytics/tracking URL or any external
// <script src>, or if vercel.json's CSP contains 'unsafe-eval' or its
// script-src contains 'unsafe-inline'. This enforces the "no tracking"
// claim in code, not just in copy.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

const failures = [];
const trackers = ['google-analytics', 'googletagmanager', 'plausible', 'umami', 'segment', 'mixpanel', 'hotjar'];
for (const t of trackers) {
  if (html.includes(t)) failures.push(`tracking URL in index.html: ${t}`);
}
if (/<script[^>]+src="https?:\/\//i.test(html)) failures.push('external <script src> in index.html');
if (!html.includes('application/ld+json')) failures.push('JSON-LD block missing from index.html');

const csp = (vercel.headers || [])
  .flatMap((h) => h.headers || [])
  .find((h) => h.key === 'Content-Security-Policy');
if (!csp) {
  failures.push('no Content-Security-Policy in vercel.json');
} else {
  if (csp.value.includes("'unsafe-eval'")) failures.push("CSP contains 'unsafe-eval'");
  const scriptSrc = (csp.value.match(/script-src[^;]*/) || [''])[0];
  if (scriptSrc.includes("'unsafe-inline'")) failures.push("script-src contains 'unsafe-inline'");
}

if (failures.length) {
  for (const f of failures) console.error(`claims guard FAIL: ${f}`);
  process.exit(1);
}
console.log('claims guard OK: no tracking, no external scripts, CSP intact');
