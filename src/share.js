// WebhookScope — shareable state codec (pure, no DOM).
// Encodes {v:1, json, fw, err409} as base64url for the #d= URL fragment.
// The fragment is never sent to any server. Unicode-safe via TextEncoder.
const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeShare(state) {
  const payload = {
    v: 1,
    json: (state && state.json) || '',
    fw: (state && state.fw) || '',
    err409: (state && state.err409) || '',
  };
  const bytes = enc.encode(JSON.stringify(payload));
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(code) {
  if (typeof code !== 'string' || !code) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(dec.decode(bytes));
    if (!obj || obj.v !== 1 || typeof obj.json !== 'string') return null;
    return {
      json: obj.json,
      fw: typeof obj.fw === 'string' ? obj.fw : '',
      err409: typeof obj.err409 === 'string' ? obj.err409 : '',
    };
  } catch {
    return null;
  }
}

export function shareUrl(base, state) {
  const clean = String(base || '').replace(/#.*$/, '');
  return `${clean}#d=${encodeShare(state)}`;
}

// Byte length guard: links above ~50 KB are refused by the UI.
export function shareTooLarge(json) {
  return enc.encode(json || '').length > 50 * 1024;
}
