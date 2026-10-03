// Morse Audio & Light — the telegraph as it was actually used: sound and light.
// • PLAY — synthesized sine tone through the speaker (Web Audio, no assets)
// • WAV — real bytes you can download/message (16-bit PCM, synthesized locally)
// • BLINK — fullscreen light flashes (works as a phone "flashlight" signal)
// All timing follows the PARIS standard: dot=1u, dash=3u, intra-char gap=1u,
// letter gap=3u, word gap=7u, unit = 1.2/WPM seconds.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { MORSE } from './codes';
import type { IOValue } from './core/types';

/** Normalize any input to canonical morse (`... --- ...`-style) or throw. */
export function toMorseCode(input: string): string {
  const t = input.trim();
  if (!t) throw new Error('Type something first — plain text or Morse (·/-/spaces).');
  if (/^[.-\s/·•—–_‐‒−]+$/.test(t)) {
    // already morse: unify separators
    const code = t.replace(/[·•]/g, '.').replace(/[—–_‐‒−]/g, '-').replace(/\s*\/\s*/g, ' / ').replace(/\t+|\s{2,}/g, ' / ').replace(/\s+/g, ' ').trim();
    if (!/[.-]/.test(code)) throw new Error('No dots or dashes found in that input.');
    return code;
  }
  const words: string[] = [];
  for (const rawWord of t.toUpperCase().split(/\s+/)) {
    const letters: string[] = [];
    for (const ch of rawWord) {
      const code = MORSE[ch];
      if (code) letters.push(code);
      else if (ch === '.') letters.push('.-.-.-');
    }
    if (letters.length) words.push(letters.join(' '));
  }
  if (!words.length) throw new Error('That input has no transmissible characters.');
  return words.join(' / ');
}

export interface MorseEvent { on: number; off: number; kind: '.' | '-'; }

/** Timeline in unit-seconds (multiply by 1.2/WPM for seconds). */
export function morseEvents(code: string): MorseEvent[] {
  const events: MorseEvent[] = [];
  const words = code.split(' / ');
  for (let w = 0; w < words.length; w++) {
    const letters = words[w].split(' ');
    for (let l = 0; l < letters.length; l++) {
      const els = letters[l].split('') as ('.' | '-')[];
      for (let e = 0; e < els.length; e++) {
        const lastEl = e === els.length - 1;
        const lastLetter = l === letters.length - 1;
        const lastWord = w === words.length - 1;
        const off = lastEl ? (lastLetter ? (lastWord ? 0 : 7) : 3) : 1;
        events.push({ on: els[e] === '.' ? 1 : 3, off, kind: els[e] });
      }
    }
  }
  return events;
}

/** Total duration in seconds for a given WPM. */
export function morseDuration(code: string, wpm: number): number {
  const unit = 1.2 / wpm;
  return morseEvents(code).reduce((s, ev) => s + (ev.on + ev.off) * unit, 0);
}

/* ------------------------------ WAV synthesis ----------------------------- */

export function morseWav(code: string, wpm: number, hz: number, sampleRate = 22050): Uint8Array {
  const unit = 1.2 / wpm;
  const events = morseEvents(code);
  const totalSec = events.reduce((s, ev) => s + (ev.on + ev.off) * unit, 0) + 0.05;
  if (totalSec > 40) throw new Error('That message exceeds 40 seconds of audio — split it up.');
  const n = Math.ceil(totalSec * sampleRate);
  const pcm = new Float32Array(n);
  const ramp = Math.floor(0.005 * sampleRate);
  let cursor = 0;
  for (const ev of events) {
    const len = Math.round(ev.on * unit * sampleRate);
    for (let i = 0; i < len; i++) {
      const gain = Math.min(1, i / ramp, (len - i) / ramp);
      pcm[cursor + i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.62 * gain;
    }
    cursor += len + Math.round(ev.off * unit * sampleRate);
  }
  // 16-bit PCM WAV, mono
  const data = new Uint8Array(44 + n * 2);
  const dv = new DataView(data.buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data[o + i] = s.charCodeAt(i); };
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  }
  return data;
}

/* --------------------------- live playback / blink ------------------------ */

let liveCtx: AudioContext | null = null;
let blinkAbort: { current: boolean } | null = null;

function sanitizeNumber(v: unknown, def: number, min: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

async function playTone(code: string, wpm: number, hz: number): Promise<void> {
  if (typeof AudioContext === 'undefined') throw new Error('Audio playback needs a browser with the Web Audio API.');
  if (liveCtx) { try { await liveCtx.close(); } catch { /* already closed */ } liveCtx = null; }
  const unit = 1.2 / wpm;
  const ctx = new AudioContext();
  liveCtx = ctx;
  const events = morseEvents(code);
  let t = ctx.currentTime + 0.06;
  for (const ev of events) {
    const dur = ev.on * unit;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = hz;
    osc.type = 'sine';
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.75, t + 0.005);
    g.gain.setValueAtTime(0.75, t + Math.max(0.005, dur - 0.005));
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
    t += dur + ev.off * unit;
  }
  // Return immediately — the scheduled graph plays out in the background so
  // the STOP action stays clickable for long messages.
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function blinkLight(code: string, wpm: number): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Blink mode needs a browser window.');
  if (blinkAbort) blinkAbort.current = true;
  const abort = { current: false };
  blinkAbort = abort;
  const unit = 1.2 / wpm;
  const overlay = document.createElement('div');
  overlay.className = 'morse-blink';
  overlay.innerHTML = '<p class="morse-blink__hint">MORSE LIGHT — tap anywhere to stop</p>';
  overlay.addEventListener('pointerdown', () => { abort.current = true; });
  document.body.appendChild(overlay);
  let flashes = 0;
  try {
    for (const ev of morseEvents(code)) {
      if (abort.current) break;
      overlay.classList.add('is-on');
      flashes++;
      await sleep(ev.on * unit * 1000);
      overlay.classList.remove('is-on');
      if (ev.off) await sleep(ev.off * unit * 1000);
    }
  } finally {
    overlay.remove();
    if (blinkAbort === abort) blinkAbort = null;
  }
  if (abort.current) return `${flashes} flashes sent, stopped by user`;
  return `${flashes} light elements signalled`;
}

export function stopAllMorse(): string {
  let did = 'Nothing was playing.';
  if (liveCtx) { void liveCtx.close(); liveCtx = null; did = 'Audio stopped.'; }
  if (blinkAbort) { blinkAbort.current = true; blinkAbort = null; did = 'Blink stopped.'; }
  return did;
}

function describe(code: string, wpm: number): string {
  const els = morseEvents(code).length;
  const secs = morseDuration(code, wpm);
  return `${els} elements · ${secs.toFixed(1)}s at ${wpm} WPM`;
}

defineOp({
  id: 'morse-audio',
  name: 'Morse Audio & Light',
  category: 'codes',
  description: 'Turn text or Morse into the real thing: synthesized sine beeps, a downloadable WAV file, or fullscreen light flashes to signal across the room.',
  aliases: ['morse sound', 'morse beep', 'morse play', 'morse flash', 'morse wav', 'telegraph sound', 'cw audio'],
  tags: ['morse', 'audio', 'sound', 'light', 'flash', 'wav', 'signal'],
  input: 'text',
  output: 'bytes',
  reversible: false,
  engine: 'browser',
  options: [
    { type: 'number', key: 'wpm', label: 'Speed (WPM)', default: 15, min: 5, max: 40, step: 1, help: 'Words per minute (PARIS timing). 15 is a friendly default; 25+ is operator speed.' },
    { type: 'number', key: 'hz', label: 'Tone (Hz)', default: 700, min: 300, max: 1400, step: 10, help: 'Side-tone frequency. 650–880 Hz is classic radio territory.' }
  ],
  actions: [
    {
      id: 'play', label: 'PLAY SOUND', kind: 'analyze', icon: 'signal',
      run: async (v: IOValue, o) => {
        const wpm = sanitizeNumber(o.wpm, 15, 5, 40);
        const hz = sanitizeNumber(o.hz, 700, 300, 1400);
        const code = toMorseCode(v.text);
        await playTone(code, wpm, hz);
        return textValue(`▶ Playing ${describe(code, wpm)} at ${hz} Hz — ■ STOP halts it.`);
      }
    },
    {
      id: 'wav', label: 'CREATE WAV', kind: 'transform', icon: 'download',
      run: (v: IOValue, o) => {
        const wpm = sanitizeNumber(o.wpm, 15, 5, 40);
        const hz = sanitizeNumber(o.hz, 700, 300, 1400);
        const code = toMorseCode(v.text);
        const bytes = morseWav(code, wpm, hz);
        return {
          kind: 'bytes',
          text: `WAV — ${describe(code, wpm)} at ${hz} Hz (${bytes.length} bytes). Download and send it anywhere.`,
          bytes
        };
      }
    },
    {
      id: 'blink', label: 'BLINK LIGHT', kind: 'analyze', icon: 'sparkle',
      run: async (v: IOValue, o) => {
        const wpm = sanitizeNumber(o.wpm, 15, 5, 40);
        const code = toMorseCode(v.text);
        const n = await blinkLight(code, wpm);
        return textValue(`Blink: ${n} (${describe(code, wpm)}).`);
      }
    },
    {
      id: 'stop', label: 'STOP', kind: 'verify', icon: 'x',
      run: () => textValue(stopAllMorse())
    }
  ],
  examples: [{ label: 'SOS', input: 'SOS' }, { label: 'A whisper', input: 'meet at midnight' }],
  docs: "Input can be plain text (auto-converted) or raw Morse with . and - symbols. PLAY synthesizes each element with the Web Audio API at your chosen WPM and side-tone and keeps playing in the background — STOP halts it. CREATE WAV produces a real 16-bit mono WAV file (22050 Hz) that appears in the output with its bytes; use the Download button to grab it. BLINK fills the screen with full-brightness flashes following the same timing — on a bright phone screen it works as a light signal across a dark room; tap the screen to stop.",

  warnings: ['BLINK produces bright full-screen flashes — do not use around photosensitive people.']
});
