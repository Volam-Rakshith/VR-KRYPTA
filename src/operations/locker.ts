// Secret Message Locker — REAL modern crypto (AES-256-GCM, PBKDF2-SHA-256)
// via the browser's own WebCrypto. Designed for the encrypt → share → decrypt
// workflow (see the SECRET DROP page and the VK1 share format).
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8 } from '../utils/bytes';

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Newer lib.dom typings demand Uint8Array<ArrayBuffer> for subtle.* params.
const toRigid = (u: Uint8Array) => u as unknown as Uint8Array<ArrayBuffer>;

async function lockerKey(pass: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', toRigid(utf8.encode(pass)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toRigid(salt), iterations: rounds, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Lock a message: returns the portable VK1.salt.iv.ct blob. */
export async function lockerEncrypt(message: string, pass: string): Promise<string> {
  if (pass.length < 6) throw new Error('Give a passphrase of 6+ characters (share it with the recipient privately).');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await lockerKey(pass, salt, 200_000);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toRigid(iv) }, key, toRigid(utf8.encode(message))));
  return `VK1.${b64url(salt)}.${b64url(iv)}.${b64url(ct)}`;
}

/** Unlock a VK1 blob; throws on wrong passphrase or corruption. */
export async function lockerDecrypt(payload: string, pass: string): Promise<string> {
  const m = payload.trim().match(/VK1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('No VK1 payload found.');
  const key = await lockerKey(pass, unb64url(m[1]), 200_000);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toRigid(unb64url(m[2])) }, key, toRigid(unb64url(m[3])));
  return utf8.decodeStrict(new Uint8Array(pt));
}

defineOp({
  id: 'message-locker',
  name: 'Secret Message Locker (AES-256-GCM)',
  category: 'ciphers',
  historicalName: 'AES — Rijndael (NIST standard, 2001)',
  description: 'Lock a message with a passphrase using genuine AES-256-GCM (keys stretched with PBKDF2-SHA-256, 200,000 rounds). Output travels fine as text or a QR code.',
  aliases: ['encrypt message', 'aes encrypt', 'secret message', 'locker', 'password message'],
  tags: ['cipher', 'modern', 'aes', 'secret', 'share', 'password'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'browser',
  options: [
    { type: 'text', key: 'passphrase', label: 'Passphrase', default: '', placeholder: 'shared secretly with the recipient' }
  ],
  actions: [
    {
      id: 'encipher', label: '🔒 Lock', kind: 'transform',
      run: async (v, o) => {
        const pass = String(o.passphrase ?? '');
        if (pass.length < 6) throw new Error('Give a passphrase of 6+ characters (share it with the recipient privately).');
        if (!v.text) throw new Error('Nothing to lock — type the secret message first.');
        const blob = await lockerEncrypt(v.text, pass);
        return textValue(blob, 'encoded');
      }
    },
    {
      id: 'decipher', label: '🔓 Unlock', kind: 'transform',
      run: async (v, o) => {
        const pass = String(o.passphrase ?? '');
        if (!pass) throw new Error('Enter the passphrase this message was locked with.');
        const m = v.text.trim().match(/VK1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
        if (!m) throw new Error('No VK1 payload found — paste the blob starting "VK1."');
        try {
          const key = await lockerKey(pass, unb64url(m[1]), 200_000);
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toRigid(unb64url(m[2])) }, key, toRigid(unb64url(m[3])));
          return textValue(utf8.decodeStrict(new Uint8Array(pt)));
        } catch {
          throw new Error('Decryption failed — wrong passphrase or a corrupted payload.');
        }
      }
    }
  ],
  examples: [{ label: 'A secret', input: 'meet at the old lighthouse at midnight 🔦' }],
  docs: 'Unlike everything else in this section, this is real modern cryptography: a random 128-bit salt, 200k rounds of PBKDF2-SHA-256 to stretch your passphrase into a 256-bit key, then AES-GCM which also AUTHENTICATES the ciphertext (tampering breaks the decrypt loudly). Format: VK1.salt.iv.ciphertext, all base64url — each lock uses a fresh random salt/IV, so the same message seals differently every time. The output is a single clean line that copies straight into a QR code or a SECRET DROP share link.',
  warnings: ['Strength is bound by the passphrase — a 6-letter one is only a toy. Use a long random passphrase shared over a separate channel for anything that matters.']
});
