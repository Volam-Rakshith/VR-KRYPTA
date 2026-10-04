// VOTE OUT IMPOSTER — original procedural audio: SFX presets + phase music,
// all synthesized via Web Audio. No samples, no copyrights, no network, and
// everything is off-by-default-safe: music starts only after a user gesture.
import { getSoundPrefs, saveSoundPrefs } from './store';
import type { SoundPrefs } from './store';

type OscType = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let currentMood: string | null = null;
let prefs: SoundPrefs | null = null;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in window)) return null;
  if (!ctx) {
    const Ctor = (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    if (prefs) master.gain.value = prefs.volume / 100;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/* --------------------------------- SFX ----------------------------------- */

export type SfxName =
  | 'start' | 'reveal' | 'imposter' | 'tick' | 'finalTick' | 'vote' | 'votesDone'
  | 'revealImposter' | 'win' | 'lose' | 'chaos' | 'guess' | 'button' | 'error';

const SFX: Record<SfxName, (c: AudioContext, out: AudioNode) => void> = {
  start: (c, out) => tone(c, out, [523, 659, 784, 1047], 'triangle', 0.09, 0.16),
  reveal: (c, out) => tone(c, out, [392, 523, 659], 'sine', 0.1, 0.22),
  imposter: (c, out) => tone(c, out, [330, 311, 330, 233], 'sawtooth', 0.16, 0.14),
  tick: (c, out) => tone(c, out, [880], 'square', 0.03, 0.05),
  finalTick: (c, out) => tone(c, out, [1174, 1760], 'square', 0.06, 0.09),
  vote: (c, out) => tone(c, out, [440, 550], 'triangle', 0.05, 0.12),
  votesDone: (c, out) => tone(c, out, [440, 554, 659, 880], 'triangle', 0.08, 0.2),
  revealImposter: (c, out) => { tone(c, out, [311, 294, 311, 220, 196], 'sawtooth', 0.18, 0.16); },
  win: (c, out) => { tone(c, out, [523, 659, 784, 1047, 1319, 1568], 'triangle', 0.1, 0.22); },
  lose: (c, out) => { tone(c, out, [392, 370, 349, 311, 262], 'sawtooth', 0.14, 0.14); },
  chaos: (c, out) => { tone(c, out, [220, 262, 330, 392, 466, 587, 466, 392], 'square', 0.08, 0.15); },
  guess: (c, out) => tone(c, out, [659, 880], 'sine', 0.09, 0.14),
  button: (c, out) => tone(c, out, [600], 'triangle', 0.025, 0.08),
  error: (c, out) => tone(c, out, [233, 220, 196], 'sawtooth', 0.09, 0.12)
};

function tone(c: AudioContext, out: AudioNode, freqs: number[], type: OscType, step: number, gainV: number): void {
  const t0 = c.currentTime;
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = c.createGain();
    const at = t0 + i * step;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gainV, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + step * 1.9);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + step * 2);
  });
}

export function sfx(name: SfxName): void {
  const p = loadPrefs();
  if (!p.sfx) return;
  const c = ensure();
  if (!c || !sfxBus) return;
  SFX[name](c, sfxBus);
}

/* ------------------------------- MUSIC ----------------------------------- */
// 100 hand-seeded procedural tracks. Every 60 s the music crossfades to a
// fresh track from the current mood's family, so it never loops the same
// 8-note bar for a whole game night. All pattern data is generated from a
// deterministic PRNG — no audio files, no network.

export type Mood = 'lobby' | 'reveal' | 'discussion' | 'voting' | 'results' | 'victory' | 'chaos' | 'off';

type Family = 'calm' | 'tense' | 'hype';

interface TrackDef {
  bpm: number;
  swing: number;              // 0..0.35 — delays every off-16th
  bassWave: OscType;
  leadWave: OscType;
  bass: number[];             // midi notes per 16th step, 0 = rest (32 steps = 2 bars)
  lead: number[];             // midi or 0
  hat: boolean[];             // 32 steps
  kick: boolean[];            // 32 steps
  cutoff: number;
  level: number;
  detune: number;             // cents spread on lead
  family: Family;
}

const MOOD_FAMILY: Record<Exclude<Mood, 'off'>, Family> = {
  lobby: 'calm',
  reveal: 'calm',
  discussion: 'calm',
  voting: 'tense',
  results: 'tense',
  chaos: 'tense',
  victory: 'hype'
};

/* deterministic PRNG so track N always sounds like track N */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

const SCALES: number[][] = [
  [0, 2, 4, 5, 7, 9, 11],   // major
  [0, 2, 3, 5, 7, 8, 10],   // natural minor
  [0, 2, 4, 7, 9],          // major pentatonic
  [0, 3, 5, 7, 10],         // minor pentatonic
  [0, 2, 3, 5, 7, 9, 10],   // dorian
  [0, 1, 3, 5, 7, 8, 10],    // phrygian
  [0, 2, 4, 5, 7, 9, 10],   // mixolydian
  [0, 2, 4, 6, 7, 9, 11],   // lydian
  [0, 2, 3, 5, 7, 8, 11],   // harmonic minor
  [0, 3, 5, 6, 7, 10]       // blues hexatonic
];

// 4-chord progressions as scale degrees — pop/engine room classics
const PROGS: number[][] = [
  [0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [0, 5, 4, 3],
  [0, 2, 4, 3], [0, 4, 1, 4], [0, 0, 5, 4], [0, 3, 0, 4],
  [5, 3, 0, 4], [0, 6, 4, 5], [0, 1, 0, 4], [3, 0, 4, 0]
];

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS: TrackDef[] = (() => {
  const out: TrackDef[] = [];
  for (let i = 0; i < 100; i++) {
    const r = mulberry(1000 + i * 7919);
    // family mix: 42 calm / 34 tense / 24 hype
    const family: Family = i % 100 < 42 ? 'calm' : i % 100 < 76 ? 'tense' : 'hype';
    const scale = pick(r, SCALES);
    const root = pick(r, [36, 38, 40, 41, 43, 45, 47]); // C1..B1 bass region
    const prog = pick(r, PROGS);
    const bpm = family === 'calm' ? 68 + Math.floor(r() * 32)
      : family === 'tense' ? 64 + Math.floor(r() * 80)
      : 108 + Math.floor(r() * 56);
    const bassDensity = family === 'hype' ? 0.85 : 0.45 + r() * 0.4;
    const leadDensity = family === 'calm' ? 0.35 + r() * 0.25 : 0.45 + r() * 0.35;
    const bass: number[] = [];
    const lead: number[] = [];
    const hat: boolean[] = [];
    const kick: boolean[] = [];
    for (let bar = 0; bar < 2; bar++) {
      for (let st = 0; st < 16; st++) {
        const chordRoot = root + scale[prog[(bar * 4 + Math.floor(st / 4)) % 4] % scale.length];
        const strong = st % 4 === 0;
        if (r() < (strong ? 0.95 : bassDensity)) {
          bass.push(chordRoot + (r() < 0.25 ? 12 : 0));
        } else bass.push(0);
        if (r() < leadDensity) {
          const deg = Math.floor(r() * scale.length);
          const oct = pick(r, [12, 12, 24, 24, 24]);
          lead.push(chordRoot + scale[deg] + oct + (prog[(bar * 4 + Math.floor(st / 4)) % 4] !== 0 ? 0 : 0));
        } else lead.push(0);
        hat.push(st % 2 === 0 ? r() < (family === 'calm' ? 0.3 : 0.65) : r() < 0.85);
        kick.push(st % 4 === 0 && (family !== 'calm' || r() < 0.4));
      }
    }
    out.push({
      bpm, swing: r() < 0.4 ? 0.1 + r() * 0.2 : 0,
      bassWave: pick(r, ['triangle', 'sine', 'sawtooth', 'square'] as OscType[]),
      leadWave: pick(r, ['triangle', 'sine', 'square'] as OscType[]),
      bass, lead, hat, kick,
      cutoff: 500 + Math.floor(r() * 1400),
      level: 0.07 + r() * 0.06,
      detune: r() < 0.3 ? Math.floor(r() * 14) - 7 : 0,
      family
    });
  }
  return out;
})();

interface Channel {
  timer: number;
  gain: GainNode;
  track: TrackDef;
}

let active: Channel | null = null;
let rotationTimer: number | null = null;
let recentTracks: number[] = [];
let lastMoodWanted: Exclude<Mood, 'off'> | null = null;

function pickTrackIndex(family: Family): number {
  const pool: number[] = [];
  for (let i = 0; i < TRACKS.length; i++) if (TRACKS[i].family === family && !recentTracks.includes(i)) pool.push(i);
  const src = pool.length ? pool : TRACKS.map((t, i) => (t.family === family ? i : -1)).filter((i) => i >= 0);
  const idx = src[Math.floor(Math.random() * src.length)];
  recentTracks.push(idx);
  if (recentTracks.length > 12) recentTracks = recentTracks.slice(-12);
  return idx;
}

function startChannel(track: TrackDef, fadeInSec: number): Channel | null {
  const c = ensure();
  if (!c || !musicBus) return null;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = track.cutoff;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, c.currentTime + fadeInSec);
  filter.connect(gain).connect(musicBus);

  const stepDur = 60 / track.bpm / 4; // 16th note
  let step = 0;
  const tickOnce = () => {
    if (!ctx) return;
    const i = step % 32;
    // swing: push every odd 16th late
    const swing = track.swing && i % 2 === 1 ? track.swing * stepDur : 0;
    const t = ctx.currentTime + 0.06 + swing;
    const b = track.bass[i];
    if (b > 0) playNote(ctx, filter, midiHz(b), track.bassWave, t, stepDur * 3.5, track.level, 0);
    const l = track.lead[i];
    if (l > 0) playNote(ctx, filter, midiHz(l), track.leadWave, t, stepDur * 1.6, track.level * 0.45, track.detune);
    if (track.hat[i]) hatBlip(ctx, filter, t, track.level * 0.30);
    if (track.kick[i]) kickThump(ctx, filter, t, track.level * 0.9);
    step++;
  };
  tickOnce();
  const timer = window.setInterval(tickOnce, stepDur * 1000);
  return { timer, gain, track };
}

function stopChannel(ch: Channel | null, fadeOutSec: number): void {
  if (!ch) return;
  window.clearInterval(ch.timer);
  if (ctx) {
    try {
      ch.gain.gain.cancelScheduledValues(ctx.currentTime);
      ch.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(0.05, fadeOutSec / 3));
      const g = ch.gain;
      window.setTimeout(() => { try { g.disconnect(); } catch { /* gone */ } }, fadeOutSec * 1000 + 400);
    } catch { /* ok */ }
  }
}

function playNote(c: AudioContext, out: AudioNode, freq: number, wave: OscType, at: number, dur: number, vol: number, detuneCents: number): void {
  const o = c.createOscillator();
  o.type = wave;
  o.frequency.value = freq;
  if (detuneCents) o.detune.value = detuneCents;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, dur));
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function hatBlip(c: AudioContext, out: AudioNode, at: number, vol: number): void {
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.value = 6500;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.06);
}

function kickThump(c: AudioContext, out: AudioNode, at: number, vol: number): void {
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(48, at + 0.09);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.2);
}

function launchRotation(): void {
  if (rotationTimer !== null) window.clearInterval(rotationTimer);
  rotationTimer = window.setInterval(() => {
    if (!currentMood || currentMood === 'off') return;
    const family = MOOD_FAMILY[currentMood as Exclude<Mood, 'off'>];
    const old = active;
    active = startChannel(TRACKS[pickTrackIndex(family)], 2.2);
    stopChannel(old, 2.2);
  }, 60_000);
}

export function music(mood: Mood): void {
  if (mood !== 'off') lastMoodWanted = mood;
  if (mood === 'off' || !loadPrefs().music) {
    stopMusic();
    return;
  }
  const family = MOOD_FAMILY[mood];
  if (currentMood === mood && active) return; // already playing this mood — rotation keeps it fresh
  currentMood = mood;
  const old = active;
  active = startChannel(TRACKS[pickTrackIndex(family)], 1.2);
  stopChannel(old, 1.2);
  launchRotation();
}

export function stopMusic(): void {
  if (rotationTimer !== null) {
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  }
  stopChannel(active, 0.6);
  active = null;
  currentMood = null;
}

/* --------------------------------- PREFS ---------------------------------- */

export function loadPrefs(): SoundPrefs {
  if (!prefs) prefs = getSoundPrefs();
  return prefs;
}

export function updatePrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  prefs = { ...loadPrefs(), ...patch };
  saveSoundPrefs(prefs);
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(prefs.volume / 100, ctx.currentTime, 0.05);
  }
  if (patch.music === false) stopMusic();
  else if (patch.music === true && lastMoodWanted) {
    // instantly start the mood the screen wanted — fixes the "dead toggle"
    const m = lastMoodWanted;
    currentMood = null;
    music(m);
  }
  return prefs;
}

export function setMasterVolume(v01: number): void {
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(v01, ctx.currentTime, 0.05);
  }
}
