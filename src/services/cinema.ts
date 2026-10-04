// Cinematic reveal helpers — pure, testable.
const CIPHER_POOL = '01ABCDEFXYZΨΦΔΞΩ§†‡≡¤#$%&/\\|<>{[]}+-*';

/**
 * Decrypt-mask: the first `shown` characters are real, everything after is
 * cipher noise (spaces and newlines pass through so structure stays).
 */
export function maskText(full: string, shown: number): string {
  const out: string[] = new Array(full.length);
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    if (ch === ' ' || ch === '\n' || ch === '\t') { out[i] = ch; continue; }
    out[i] = i < shown ? ch : CIPHER_POOL[(Math.random() * CIPHER_POOL.length) | 0];
  }
  return out.join('');
}

/** How many frames a cinematic needs: crawl pace scales with text length, capped. */
export function cinematicFrames(full: string): { frames: number; perFrame: number } {
  const len = Math.max(1, full.replace(/[\s]/g, '').length);
  const perFrame = Math.max(1, Math.ceil(len / 96));
  return { frames: Math.min(110, Math.ceil(len / perFrame)), perFrame };
}

/** Soft synth blip — one short sine chirp, no assets. */
let blipCtx: AudioContext | null = null;
export function blip(hz: number, ms = 28, gain = 0.045): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    blipCtx = blipCtx ?? new AudioContext();
    const ctx = blipCtx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(60, hz * 0.7), t + ms / 1000);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    /* sound is decoration — never break the reveal over it */
  }
}
