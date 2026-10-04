// Invisible Ink — zero-width character steganography over text.
// Payload bytes are packed 2 bits per character across four formatting
// characters that render as nothing (U+200B..U+200E), wrapped in U+2060
// WORD JOINER sentinels and glued to the end of a cover message. Paste the
// result into chats/notes — it looks like plain text, carries a secret.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8 } from '../utils/bytes';

const SENTINEL = '\u2060';
const PAYLOAD_CHARS = ['\u200B', '\u200C', '\u200D', '\u200E']; // ZWSP, ZWNJ, ZWJ, LRM
const PAYLOAD_SET = new Set(PAYLOAD_CHARS);
const MAX_SECRET = 500;

/** Hide `secret` invisibly inside/after `cover`. */
export function inkEncode(cover: string, secret: string): string {
  const payloadBytes = utf8.encode(secret);
  if (!payloadBytes.length) throw new Error('Nothing to hide — give the secret text.');
  if (secret.length > MAX_SECRET) throw new Error(`Ghost bunkers are for short secrets (max ${MAX_SECRET} chars) — use the SECRET DROP link for bigger ones.`);
  let payload = '';
  for (const b of payloadBytes) {
    payload += PAYLOAD_CHARS[b >> 6] + PAYLOAD_CHARS[(b >> 4) & 3] + PAYLOAD_CHARS[(b >> 2) & 3] + PAYLOAD_CHARS[b & 3];
  }
  return cover + SENTINEL + payload + SENTINEL;
}

/** Extract every invisible-ink secret from `text` (null when none). */
export function inkDecode(text: string): string | null {
  const re = new RegExp(SENTINEL + '([^' + SENTINEL + ']*)' + SENTINEL, 'g');
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const chars = Array.from(m[1]).filter((c) => PAYLOAD_SET.has(c));
    if (!chars.length || chars.length % 4 !== 0) continue;
    const bytes = new Uint8Array(chars.length / 4);
    for (let i = 0; i < chars.length; i += 4) {
      bytes[i / 4] =
        (PAYLOAD_CHARS.indexOf(chars[i]) << 6) |
        (PAYLOAD_CHARS.indexOf(chars[i + 1]) << 4) |
        (PAYLOAD_CHARS.indexOf(chars[i + 2]) << 2) |
        PAYLOAD_CHARS.indexOf(chars[i + 3]);
    }
    try {
      found.push(utf8.decodeStrict(bytes));
    } catch {
      /* broken payload — skip this sentinel pair */
    }
  }
  return found.length ? found.join('\n———\n') : null;
}

/** True when text carries any invisible-ink block. */
export function hasInk(text: string): boolean {
  return text.includes(SENTINEL) && Array.from(text).some((c) => PAYLOAD_SET.has(c));
}

defineOp({
  id: 'invisible-ink',
  name: 'Invisible Ink (Zero-Width)',
  category: 'codes',
  description: 'Hides a secret in formatting characters that render as NOTHING, glued behind innocent cover text. Paste it anywhere — it stays invisible. Decode extracts it.',
  aliases: ['zero width', 'hidden message', 'invisible text', 'zwsp', 'secret ink', 'stealth text'],
  tags: ['steganography', 'zero-width', 'hidden', 'chat', 'secret'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'browser',
  options: [
    { type: 'text', key: 'secret', label: 'Secret to hide', default: '', placeholder: 'the invisible message…', help: 'Up to 500 characters. Only used by HIDE.' }
  ],
  actions: [
    {
      id: 'encipher', label: '🫥 HIDE THE SECRET', kind: 'transform',
      run: (v, o) => {
        const secret = String(o.secret ?? '');
        return textValue(inkEncode(v.text.trim() || '', secret), 'encoded');
      }
    },
    {
      id: 'decipher', label: '👁 EXTRACT', kind: 'decode',
      run: (v) => {
        const out = inkDecode(v.text);
        if (out === null) throw new Error('No invisible ink detected — this text is clean (or the platform stripped the invisible characters).');
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Classic friend move', input: "can't talk rn, busy with school 😅", options: { secret: 'meet at midnight' } }],
  docs: 'Works by mapping the secret\u2019s bytes to four zero-width formatting characters (U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+200E LRM — two bits each) wrapped in U+2060 WORD JOINER sentinels, appended to your cover text. The invisible payload survives copy/paste on most platforms (WhatsApp, Instagram DMs, Discord, Telegram usually preserve it). If a platform normalizes whitespace it may strip the secret — always test by pasting back into EXTRACT first. This is steganography, NOT encryption: anyone who knows the trick can read it. For real secrecy lock it in the SECRET DROP first, then ghost-wrap the blob.',
  warnings: ['Obfuscation, not encryption — carriers stay readable', 'Some platforms strip zero-width characters — test before depending on it']
});
