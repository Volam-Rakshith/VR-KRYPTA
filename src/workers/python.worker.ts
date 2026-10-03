// Pyodide host worker (classic script, so importScripts is available).
// Loads the runtime lazily from CDN, installs the krypta_engine module
// into the in-memory filesystem, then serves function calls over messages.
/// <reference lib="webworker" />

declare function loadPyodide(opts: { indexURL: string }): Promise<PyodideApi>;

interface PyodideApi {
  runPython(code: string): unknown;
  FS: { writeFile(path: string, data: string): void };
  setStdout(opts: { batched(s: string): void }): void;
  setStderr(opts: { batched(s: string): void }): void;
}

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

/* ------------------------------------------------------------------------ */
/* krypta_engine — the Python transformation package.                        */
/* Pure standard library: hashlib + classical-cipher implementations.        */
/* ------------------------------------------------------------------------ */

const KRYPTA_PY = `
import json, hashlib

# ----------------------------- digest utilities ----------------------------

def _digest(name, data, digest_size=None):
    h = hashlib.new(name)
    if digest_size is not None:
        h = hashlib.new(name, digest_size=digest_size)
    h.update(data)
    return h.hexdigest()

def sha3_256(text): return _digest('sha3_256', text.encode('utf-8'))
def sha3_512(text): return _digest('sha3_512', text.encode('utf-8'))
def shake_256(text): return hashlib.shake_256(text.encode('utf-8')).hexdigest(32)
def blake2b(text): return hashlib.blake2b(text.encode('utf-8')).hexdigest()
def blake2s(text): return hashlib.blake2s(text.encode('utf-8')).hexdigest()

# ------------------------------ square helpers -----------------------------

def _keyed_alphabet(key, base='ABCDEFGHIKLMNOPQRSTUVWXYZ'):
    seen, out = set(), ''
    for ch in (key.upper().replace('J', 'I') + base):
        if ch in base and ch not in seen:
            seen.add(ch); out += ch
    return out

# --------------------------------- bifid -----------------------------------

def bifid(text, key='', period=5, mode='enc'):
    alpha = _keyed_alphabet(key or '')
    period = max(1, int(period))
    clean = text.upper().replace('J', 'I')
    clean = ''.join(c for c in clean if c in alpha)
    def pos(ch): i = alpha.index(ch); return (i // 5, i % 5)
    def cell(r, c): return alpha[r * 5 + c]
    def enc_block(b):
        nums = [pos(c) for c in b]
        flat = [n for pair in nums for n in pair]
        rows, cols = flat[0::2], flat[1::2]
        merged = list(rows) + list(cols)
        return cellstr(merged)
    def cellstr(flat):
        out = ''
        for i in range(0, len(flat), 2):
            out += cell(flat[i], flat[i + 1])
        return out
    if mode == 'enc':
        return ''.join(enc_block(clean[i:i+period]) for i in range(0, len(clean), period))
    # decrypt
    def dec_block(b):
        count = len(b)
        merged = [pos(c) for c in b]
        flat = [n for pair in merged for n in pair]
        rows, cols = flat[:count], flat[count:]
        return ''.join(cell(rows[i], cols[i]) for i in range(count))
    return ''.join(dec_block(clean[i:i+period]) for i in range(0, len(clean), period))

# --------------------------------- trifid ----------------------------------

def trifid(text, key='', period=5, mode='enc'):
    base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.'
    seen, alpha = set(), ''
    for ch in ((key or '').upper() + base):
        if ch in base and ch not in seen:
            seen.add(ch); alpha += ch
    period = max(1, int(period))
    clean = ''.join(c for c in text.upper() if c in alpha)
    def pos(ch): i = alpha.index(ch); return (i // 9, (i // 3) % 3, i % 3)
    def cell(t): return alpha[t[0] * 9 + t[1] * 3 + t[2]]
    def enc_block(b):
        nums = [pos(c) for c in b]
        a = [t[0] for t in nums]; d = [t[1] for t in nums]; u = [t[2] for t in nums]
        merged = a + d + u
        return ''.join(cell((merged[i], merged[i+1], merged[i+2])) for i in range(0, len(merged), 3))
    def dec_block(b):
        n = len(b)
        merged = [pos(c) for c in b]
        flat = [x for t in merged for x in t]
        a, d, u = flat[:n], flat[n:2*n], flat[2*n:]
        return ''.join(cell((a[i], d[i], u[i])) for i in range(n))
    f = enc_block if mode == 'enc' else dec_block
    return ''.join(f(clean[i:i+period]) for i in range(0, len(clean), period))

# -------------------------------- nihilist ---------------------------------

def nihilist(text, key, alpha_key='', mode='enc'):
    if not key or not key.strip():
        raise ValueError('Nihilist cipher requires a letter key word.')
    alpha = _keyed_alphabet(alpha_key or '')
    def pair(ch):
        c = 'I' if ch == 'J' else ch
        i = alpha.index(c) if c in alpha else None
        if i is None: raise ValueError('Character outside the square: ' + c)
        return (i // 5 + 1) * 10 + (i % 5 + 1)
    key_clean = ''.join(c for c in key.upper() if c in alpha or c == 'J')
    if not key_clean: raise ValueError('Key word contains no usable letters.')
    key_nums = [pair(c) for c in key_clean]
    if mode == 'enc':
        clean = ''.join(c for c in text.upper() if c in alpha or c == 'J')
        if not clean: raise ValueError('Nothing encodable: input needs letters A-Z.')
        return ' '.join(str(pair(c) + key_nums[i % len(key_nums)]) for i, c in enumerate(clean))
    toks = text.split()
    out = ''
    for i, t in enumerate(toks):
        if not t.isdigit(): raise ValueError('Nihilist ciphertext must be space-separated numbers, got: ' + t)
        val = int(t) - key_nums[i % len(key_nums)]
        if val < 11 or val > 55 or val % 10 == 0 or val % 10 > 5:
            raise ValueError('Decoded pair out of range for ' + t + '. Check the key.')
        out += alpha[((val // 10) - 1) * 5 + (val % 10) - 1]
    return out

# ------------------------------ four-square --------------------------------

def foursquare(text, key1='', key2='', mode='enc'):
    plain = _keyed_alphabet('')
    sq1 = _keyed_alphabet(key1 or '')
    sq2 = _keyed_alphabet(key2 or '')
    letters = ''.join(c for c in text.upper().replace('J', 'I') if c in plain)
    if mode == 'enc' and len(letters) % 2: letters += 'X'
    if len(letters) % 2: raise ValueError('Ciphertext must contain an even number of letters.')
    if not letters: raise ValueError('Input needs letters A-Z.')
    out = ''
    for i in range(0, len(letters), 2):
        a, b = letters[i], letters[i + 1]
        if mode == 'enc':
            ia, ib = plain.index(a), plain.index(b)
            ra, ca, rb, cb = ia // 5, ia % 5, ib // 5, ib % 5
            out += sq1[ra * 5 + cb] + sq2[rb * 5 + ca]
        else:
            ia, ib = sq1.index(a), sq2.index(b)
            ra, cb, rb, ca = ia // 5, ia % 5, ib // 5, ib % 5
            out += plain[ra * 5 + ca] + plain[rb * 5 + cb]
    return out

# -------------------------- fractionated morse -----------------------------

_FM = {
 'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.',
 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.',
 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-',
 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..',
 '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
 '6': '-....', '7': '--...', '8': '---..', '9': '----.'}

def _fm_trigrams():
    syms = ['.', '-', 'x']
    tris = []
    for a in syms:
        for b in syms:
            for c in syms:
                t = a + b + c
                if t != 'xxx': tris.append(t)
    return tris  # 26 trigrams, alphabetical base-3 order

def fractionated_morse(text, key='', mode='enc'):
    base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    seen, kalpha = set(), ''
    for ch in ((key or '').upper() + base):
        if ch in base and ch not in seen:
            seen.add(ch); kalpha += ch
    tris = _fm_trigrams()
    tri_to_letter = {tris[i]: kalpha[i] for i in range(26)}
    letter_to_tri = {tri_to_letter[t]: t for t in tri_to_letter}
    rev_morse = {v: k for k, v in _FM.items()}
    if mode == 'enc':
        clean = text.upper()
        stream = ''
        for c in clean:
            if c == ' ': stream += 'xx'
            elif c in _FM: stream += _FM[c] + 'x'
            else: raise ValueError('Unsupported character for fractionated Morse: ' + c)
        while len(stream) % 3: stream += 'x'
        out = ''
        for i in range(0, len(stream), 3):
            out += tri_to_letter[stream[i:i+3]]
        return out
    stream = ''
    for c in text.upper():
        if c not in letter_to_tri:
            raise ValueError('Ciphertext letter outside the key alphabet: ' + c)
        stream += letter_to_tri[c]
    letters, cur = [], ''
    for c in stream:
        if c == 'x':
            if cur:
                if cur not in rev_morse: raise ValueError('Bad Morse group "' + cur + '" while decoding — wrong key?')
                letters.append(rev_morse[cur]); cur = ''
            else:
                if letters and letters[-1] != ' ': letters.append(' ')
        else:
            cur += c
    if cur:
        if cur in rev_morse: letters.append(rev_morse[cur])
    return ''.join(letters).strip()

# ---------------------------------- hill -----------------------------------

def _mod_inverse(a, m):
    a %= m
    for x in range(1, m):
        if (a * x) % m == 1: return x
    return None

def _det2(m): return m[0][0] * m[1][1] - m[0][1] * m[1][0]
def _det3(m):
    return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
          - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
          + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))

def hill(text, matrix, mode='enc'):
    try:
        nums = [int(x) for x in str(matrix).replace('/', ' ').replace(',', ' ').split()]
    except Exception:
        raise ValueError('Matrix must be numbers like "3 2 5 7" (2x2) or 9 numbers (3x3).')
    n = 2 if len(nums) == 4 else 3 if len(nums) == 9 else 0
    if n == 0: raise ValueError('Hill matrix needs exactly 4 (2x2) or 9 (3x3) integers.')
    M = [nums[i*n:(i+1)*n] for i in range(n)]
    det = _det2(M) if n == 2 else _det3(M)
    inv = _mod_inverse(det, 26)
    if inv is None:
        raise ValueError('Matrix determinant %d is not invertible mod 26 — pick another key matrix.' % det)
    if mode == 'dec':
        if n == 2:
            adj = [[M[1][1], -M[0][1]], [-M[1][0], M[0][0]]]
        else:
            cof = []
            for i in range(3):
                row = []
                for j in range(3):
                    minor = [[M[x][y] for y in range(3) if y != j] for x in range(3) if x != i]
                    row.append(((-1) ** (i + j)) * _det2(minor))
                cof.append(row)
            adj = [[cof[j][i] for j in range(3)] for i in range(3)]
        M = [[(inv * adj[i][j]) % 26 for j in range(n)] for i in range(n)]
    letters = ''.join(c for c in text.upper() if 'A' <= c <= 'Z')
    if not letters: raise ValueError('Input needs letters A-Z.')
    while mode == 'enc' and len(letters) % n: letters += 'X'
    if len(letters) % n: raise ValueError('Ciphertext length must be a multiple of %d.' % n)
    out = ''
    for i in range(0, len(letters), n):
        vec = [ord(c) - 65 for c in letters[i:i+n]]
        res = [sum(M[r][k] * vec[k] for k in range(n)) % 26 for r in range(n)]
        out += ''.join(chr(x + 65) for x in res)
    return out

# ------------------------------- dispatcher --------------------------------

def handle(fn, args_json):
    args = json.loads(args_json)
    try:
        if fn == 'sha3_256': out = sha3_256(args['text'])
        elif fn == 'sha3_512': out = sha3_512(args['text'])
        elif fn == 'shake_256': out = shake_256(args['text'])
        elif fn == 'blake2b': out = blake2b(args['text'])
        elif fn == 'blake2s': out = blake2s(args['text'])
        elif fn == 'bifid': out = bifid(args['text'], args.get('key',''), args.get('period',5), args['mode'])
        elif fn == 'trifid': out = trifid(args['text'], args.get('key',''), args.get('period',5), args['mode'])
        elif fn == 'nihilist': out = nihilist(args['text'], args.get('key',''), args.get('alphaKey',''), args['mode'])
        elif fn == 'foursquare': out = foursquare(args['text'], args.get('key1',''), args.get('key2',''), args['mode'])
        elif fn == 'fractionated_morse': out = fractionated_morse(args['text'], args.get('key',''), args['mode'])
        elif fn == 'hill': out = hill(args['text'], args.get('matrix',''), args['mode'])
        else: raise ValueError('unknown function: ' + fn)
        return json.dumps({'ok': True, 'text': out})
    except Exception as e:
        return json.dumps({'ok': False, 'error': str(e)})
`;

let pyodide: PyodideApi | null = null;

async function init(): Promise<void> {
  importScripts(PYODIDE_URL);
  pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });
  pyodide.FS.writeFile('/krypta_engine.py', KRYPTA_PY);
  pyodide.runPython('import sys; sys.path.insert(0, "/"); import krypta_engine');
}

interface CallMessage {
  type: 'init' | 'call';
  id: number;
  fn?: string;
  args?: Record<string, unknown>;
}

self.onmessage = async (ev: MessageEvent<CallMessage>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      if (!pyodide) await init();
      (self as unknown as Worker).postMessage({ type: 'ready' });
      return;
    }
    if (msg.type === 'call' && pyodide) {
      const code = `krypta_engine.handle(${JSON.stringify(msg.fn)}, ${JSON.stringify(JSON.stringify(msg.args ?? {}))})`;
      const raw = pyodide.runPython(code) as string;
      (self as unknown as Worker).postMessage({ type: 'result', id: msg.id, payload: JSON.parse(raw) });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'result', id: msg.id ?? -1, payload: { ok: false, error: String(err) }, initError: msg.type === 'init' });
  }
};

export {};
