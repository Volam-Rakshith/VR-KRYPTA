// VOTE OUT IMPOSTER — original procedural audio: SFX presets + phase music,
// all synthesized via Web Audio. No samples, no copyrights, no network, and
// everything is off-by-default-safe: music starts only after a user gesture.
import { getSoundPrefs, saveSoundPrefs } from './store';
import type { SoundPrefs } from './store';

type OscType = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicTimer: number | null = null;
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
  if (!c || !master) return;
  SFX[name](c, master);
}

/* --------------------------------- MUSIC ---------------------------------- */

export type Mood = 'lobby' | 'reveal' | 'discussion' | 'voting' | 'results' | 'victory' | 'chaos' | 'off';

interface MoodDef {
  tempo: number; // beats per minute of an 8-step pattern
  bass: number[];
  pluck: number[];
  wave: OscType;
  filter: number;
  level: number;
}

const MOODS: Record<Exclude<Mood, 'off'>, MoodDef> = {
  lobby:      { tempo: 92,  bass: [110, 110, 165, 110, 110, 131, 165, 98],  pluck: [440, 523, 659, 523, 440, 659, 523, 440], wave: 'triangle', filter: 900,  level: 0.11 },
  reveal:     { tempo: 60,  bass: [98, 0, 98, 0, 87, 0, 98, 0],            pluck: [392, 0, 311, 0, 392, 0, 294, 0],          wave: 'sine',     filter: 600,  level: 0.13 },
  discussion: { tempo: 72,  bass: [73, 73, 98, 73, 73, 87, 98, 65],        pluck: [294, 330, 294, 262, 294, 0, 330, 0],      wave: 'triangle', filter: 500,  level: 0.09 },
  voting:     { tempo: 66,  bass: [87, 0, 110, 0, 87, 0, 131, 0],          pluck: [349, 0, 392, 0, 349, 0, 311, 0],          wave: 'square',   filter: 700,  level: 0.08 },
  results:    { tempo: 100, bass: [131, 131, 98, 131, 87, 98, 131, 165],   pluck: [523, 659, 784, 659, 523, 440, 523, 0],    wave: 'triangle', filter: 1000, level: 0.12 },
  victory:    { tempo: 112, bass: [131, 165, 196, 165, 131, 165, 196, 262], pluck: [523, 784, 659, 1047, 784, 659, 523, 0],  wave: 'triangle', filter: 1200, level: 0.13 },
  chaos:      { tempo: 140, bass: [110, 117, 110, 124, 110, 117, 139, 131], pluck: [440, 466, 440, 415, 440, 494, 466, 440], wave: 'square',   filter: 800,  level: 0.1 }
};

export function music(mood: Mood): void {
  if (mood === 'off' || !loadPrefs().music) {
    stopMusic();
    return;
  }
  const c = ensure();
  if (!c || !master || !musicBus) return;
  if (currentMood === mood && musicTimer !== null) return;
  stopMusic();
  currentMood = mood;
  const def = MOODS[mood];
  const stepDur = 60 / def.tempo / 2;
  let step = 0;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = def.filter;
  filter.connect(musicBus);
  const schedule = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.06;
    const beat = def.bass[step % 8];
    if (beat > 0) {
      playNote(ctx, filter, beat, def.wave, t, stepDur * 1.8, def.level * 0.55);
      const plk = def.pluck[step % 8];
      if (plk > 0) playNote(ctx, filter, plk, def.wave, t, stepDur * 0.9, def.level * 0.32);
    }
    step++;
  };
  schedule();
  musicTimer = window.setInterval(schedule, stepDur * 1000);
}

function playNote(c: AudioContext, out: AudioNode, freq: number, wave: OscType, at: number, dur: number, vol: number): void {
  const o = c.createOscillator();
  o.type = wave;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.05, dur));
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export function stopMusic(): void {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
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
  if (master) master.gain.value = prefs.volume / 100;
  return prefs;
}

export function setMasterVolume(v01: number): void {
  if (master && ctx) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(v01, ctx.currentTime, 0.05);
  }
}
