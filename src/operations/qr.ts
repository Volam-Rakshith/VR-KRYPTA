// QR codes: generator (rendered as scannable block art) + scanner (from an
// image file loaded into the workspace). Plus the Secret Message Locker —
// REAL modern crypto (AES-256-GCM, PBKDF2-SHA-256) via the browser's own
// WebCrypto, designed for the encrypt → QR → share → decrypt workflow.
// QR generation uses the small, widely-vetted qrcode-generator library (MIT,
// kazuhikoarase) vendored via npm — provenance stated honestly in the docs.
import qrcode from 'qrcode-generator';
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

/* ------------------------------ QR generator ------------------------------- */

type Ecc = 'L' | 'M' | 'Q' | 'H';

function renderQR(text: string, ecc: Ecc, half: boolean): string {
  const qr = qrcode(0, ecc);
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2; // quiet-zone modules each side (scanner minimum is 4 modules total around)
  if (half) {
    // two modules per character cell using upper/lower half blocks
    const cell: Record<string, string> = { '00': ' ', '10': '▀', '01': '▄', '11': '█' };
    const lines: string[] = [];
    const totalRows = n + quiet * 2;
    const dark = (r: number, c: number) => {
      const rr = r - quiet, cc = c - quiet;
      return rr >= 0 && rr < n && cc >= 0 && cc < n ? qr.isDark(rr, cc) : false;
    };
    for (let r = 0; r < totalRows; r += 2) {
      let line = '';
      for (let c = 0; c < n + quiet * 2; c++) {
        const top = dark(r, c) ? '1' : '0';
        const bot = r + 1 < totalRows && dark(r + 1, c) ? '1' : '0';
        line += cell[top + bot];
      }
      lines.push(line);
    }
    return lines.join('\n');
  }
  let out = '';
  for (let r = -quiet; r < n + quiet; r++) {
    let line = '';
    for (let c = -quiet; c < n + quiet; c++) {
      const dark = r >= 0 && r < n && c >= 0 && c < n && qr.isDark(r, c);
      line += dark ? '██' : '  ';
    }
    out += (line ? line : '') + '\n';
  }
  return out.trimEnd();
}

defineOp({
  id: 'qr-code',
  name: 'QR Code Generator',
  category: 'codes',
  description: 'Real QR codes rendered as scannable block art — auto version sizing, four error-correction levels. Show it fullscreen and any phone camera scans it.',
  aliases: ['qr', 'qr code', 'qrcode generator', 'qr art'],
  tags: ['code', 'qr', 'share', 'scan'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  engine: 'browser',
  options: [
    { type: 'select', key: 'ecc', label: 'Error correction', default: 'M', options: [
      { value: 'L', label: 'L — 7% (dense)' },
      { value: 'M', label: 'M — 15% (default)' },
      { value: 'Q', label: 'Q — 25%' },
      { value: 'H', label: 'H — 30% (most robust)' }
    ] },
    { type: 'select', key: 'render', label: 'Render style', default: 'half', options: [
      { value: 'half', label: 'Compact (half blocks)' },
      { value: 'full', label: 'Large (full blocks)' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Generate QR', kind: 'encode',
      run: (v, o) => {
        const text = v.text;
        if (!text) throw new Error('Type or paste the payload first (a link, a secret, a message-locker blob…).');
        if (utf8.encode(text).length > 500) throw new Error('Display limit: 500 bytes of payload — QR past that is unreadable at screen scale anyway.');
        try {
          const art = renderQR(text, String(o.ecc ?? 'M') as Ecc, o.render === 'half');
          return textValue(`${art}\n\n— scan straight off the screen (zoom in / fullscreen helps). Payload: ${utf8.encode(text).length} bytes, ECC ${o.ecc}.`, 'encoded');
        } catch (e) {
          throw new Error(`QR capacity exceeded for this ECC level: ${e instanceof Error ? e.message : e}. Try ECC level L or a shorter payload.`);
        }
      }
    }
  ],
  examples: [{ label: 'Share a link', input: 'https://volam-rakshith.github.io/VR-KRYPTA/' }],
  docs: 'Generated with the vetted qrcode-generator library (MIT, kazuhikoarase, vendored via npm). Block art includes a quiet zone — phone cameras scan it directly off the screen. Larger payloads produce bigger grids: the compact half-block style keeps them scannable.'
});

/* ------------------------------- QR scanner -------------------------------- */

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource | HTMLCanvasElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window { BarcodeDetector?: { new (options?: { formats: string[] }): BarcodeDetectorLike } }
}

defineOp({
  id: 'qr-scan',
  name: 'QR Code Scanner',
  category: 'codes',
  description: 'Reads a QR code from an image FILE you load into the workspace (File → hex). Uses the browser-native BarcodeDetector where available.',
  aliases: ['scan qr', 'qr reader', 'decode qr', 'read qr code'],
  tags: ['code', 'qr', 'scan'],
  input: 'bytes',
  output: 'text',
  reversible: false,
  engine: 'browser',
  actions: [
    {
      id: 'decode', label: 'Scan image', kind: 'decode',
      run: async (v) => {
        if (typeof window === 'undefined' || !window.BarcodeDetector) {
          throw new Error('This browser has no BarcodeDetector API (Chromium-based browsers ship it). Try Chrome/Edge — or paste the QR payload text directly.');
        }
        const bytes = v.bytes ?? hexToBytes(v.text);
        if (bytes.length < 50) throw new Error('Load the QR image via “File → hex” in the input panel (PNG or screenshot). Raw text is not an image.');
        const blob = new Blob([bytes.buffer as ArrayBuffer]);
        let bitmap: ImageBitmap;
        try { bitmap = await createImageBitmap(blob); }
        catch { throw new Error('Could not decode that as an image — load a PNG/JPEG/WebP screenshot of the QR code.'); }
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) throw new Error('Canvas 2D context unavailable.');
        ctx2d.drawImage(bitmap, 0, 0);
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const found = await detector.detect(canvas);
        if (!found.length) throw new Error('No QR code found in the image — crop tightly around the code including its white border.');
        return textValue(found.length === 1 ? found[0].rawValue : found.map((f, i) => `[${i + 1}] ${f.rawValue}`).join('\n'));
      }
    }
  ],
  docs: 'Flow: point your workspace input at an image (File → hex), run “Scan image”. On browsers without BarcodeDetector the op reports that honestly instead of pretending.',
  warnings: ['BarcodeDetector support: Chrome/Edge yes; Firefox/Safari vary by version — the op tells you if yours lacks it.']
});

/* -------------------------- secret message locker --------------------------- */

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** TS-side helper: guarantees a Uint8Array over a plain ArrayBuffer for WebCrypto. */
function toRigid(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(u) as Uint8Array<ArrayBuffer>;
}

async function lockerKey(pass: string, salt: Uint8Array, rounds: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', toRigid(utf8.encode(pass)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as Uint8Array<ArrayBuffer>, iterations: rounds, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
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
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await lockerKey(pass, salt, 200_000);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toRigid(iv) }, key, toRigid(utf8.encode(v.text))));
        const blob = `VK1.${b64url(salt)}.${b64url(iv)}.${b64url(ct)}`;
        return textValue(`${blob}\n\n— AES-256-GCM + PBKDF2(200k). Send this blob any way you like (QR Generator makes it scannable); only the passphrase opens it. Each lock uses a fresh random salt/IV.`, 'encoded');
      }
    },
    {
      id: 'decipher', label: '🔓 Unlock', kind: 'transform',
      run: async (v, o) => {
        const pass = String(o.passphrase ?? '');
        if (!pass) throw new Error('Enter the passphrase this message was locked with.');
        const m = v.text.trim().match(/VK1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
        if (!m) throw new Error('No VK1 payload found — paste the blob starting "VK1." (the explanatory footer is fine to include).');
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
  docs: 'Unlike everything else in this section, this is real modern cryptography: a random 128-bit salt, 200k rounds of PBKDF2-SHA-256 to stretch your passphrase into a 256-bit key, then AES-GCM which also AUTHENTICATES the ciphertext (tampering breaks the decrypt loudly). Format: VK1.salt.iv.ciphertext, all base64url. Pair with the QR Code Generator to send secrets through images or paper.',
  warnings: ['Strength is bound by the passphrase — a 6-letter one is only a toy. Use a long random passphrase shared over a separate channel for anything that matters.']
});
