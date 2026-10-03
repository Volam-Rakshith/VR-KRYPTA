// Share-out codec — packs an operation id + its text output into a
// URL-safe string so results can travel as links and QR codes.
// Format inside the hash: x/<opId>/<base64url(payload)>

/** Keep shared payloads small — a link around ~2.4k chars still scans as a QR. */
export const SHARE_TEXT_LIMIT = 1800;

function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Full absolute share link fragment for a result (everything after `#/share/`). */
export function capturedFragment(opId: string, text: string): string {
  return `x/${encodeURIComponent(opId)}/${toB64Url(text)}`;
}

/** Decode a `/share/…` fragment back into op + text. Returns null on any corruption. */
export function parseCaptured(rest: string): { opId: string; text: string } | null {
  if (!rest.startsWith('x/')) return null;
  const body = rest.slice(2);
  const sep = body.indexOf('/');
  if (sep < 1 || sep === body.length - 1) return null;
  const opId = /^[a-z0-9-]+$/.test(body.slice(0, sep)) ? body.slice(0, sep) : null;
  if (!opId) return null;
  try {
    const text = fromB64Url(body.slice(sep + 1));
    if (text.length > SHARE_TEXT_LIMIT * 2) return null;
    return { opId, text };
  } catch {
    return null;
  }
}

/** Invite text that goes with the link when sharing to a person. */
export function capturedInvite(opName: string, link: string): string {
  return (
    `🔍 I encoded something with ${opName} on VR KRYPTA.\n\n${link}\n\n` +
    `Open it to see the code — there's a button to transform it right there.\n— via VR KRYPTA by VR DEVELOPMENTS`
  );
}
