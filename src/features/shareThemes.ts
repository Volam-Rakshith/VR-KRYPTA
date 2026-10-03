// SECRET DROP 2.0 — parametric theme engine for the reveal experience.
// 12 neon palettes × 9 background patterns = 108 named styles. The palette
// + pattern indices ride inside the share URL as a tiny `/s<index>` suffix,
// so the recipient sees exactly the card you designed.

export interface Palette { name: string; c1: string; c2: string; c3: string; }
export interface Pattern { name: string; cls: string; }
export interface DropStyle { index: number; name: string; palette: Palette; pattern: Pattern; }

const PALETTES: Palette[] = [
  { name: 'KRYPTA NEON', c1: '#22d3ee', c2: '#8b5cf6', c3: '#3b82f6' },
  { name: 'HEAT WAVE', c1: '#fb923c', c2: '#ef4444', c3: '#f43f5e' },
  { name: 'SYNTH ROSE', c1: '#f472b6', c2: '#a855f7', c3: '#22d3ee' },
  { name: 'ACID RAIN', c1: '#a3e635', c2: '#22c55e', c3: '#14b8a6' },
  { name: 'DEEP SPACE', c1: '#818cf8', c2: '#312e81', c3: '#22d3ee' },
  { name: 'GOLD RUSH', c1: '#fbbf24', c2: '#b45309', c3: '#fb923c' },
  { name: 'ICE PICK', c1: '#67e8f9', c2: '#e0f2fe', c3: '#60a5fa' },
  { name: 'ULTRAVIOLET', c1: '#c084fc', c2: '#7c3aed', c3: '#f0abfc' },
  { name: 'BLOOD PACT', c1: '#f87171', c2: '#7f1d1d', c3: '#fb923c' },
  { name: 'PACIFIC', c1: '#2dd4bf', c2: '#0e7490', c3: '#0ea5e9' },
  { name: 'GHOST PROTOCOL', c1: '#e2e8f0', c2: '#64748b', c3: '#cbd5e1' },
  { name: 'JAEGER', c1: '#facc15', c2: '#fb923c', c3: '#ef4444' }
];

const PATTERNS: Pattern[] = [
  { name: 'Grid', cls: 'sdp-grid' },
  { name: 'Circuit', cls: 'sdp-circuit' },
  { name: 'Stardust', cls: 'sdp-stars' },
  { name: 'Diagonal', cls: 'sdp-diagonal' },
  { name: 'Hex Field', cls: 'sdp-hex' },
  { name: 'Ripples', cls: 'sdp-ripples' },
  { name: 'Crosshatch', cls: 'sdp-cross' },
  { name: 'Bubbles', cls: 'sdp-bubbles' },
  { name: 'Dark Matter', cls: 'sdp-matter' }
];

export const STYLE_COUNT = PALETTES.length * PATTERNS.length; // 108

export function styleAt(index: number): DropStyle {
  const i = ((index % STYLE_COUNT) + STYLE_COUNT) % STYLE_COUNT;
  const p = PALETTES[i % PALETTES.length];
  const t = PATTERNS[Math.floor(i / PALETTES.length)];
  return { index: i, name: `${p.name} · ${t.name}`, palette: p, pattern: t };
}

export function randomStyleIndex(except = -1): number {
  let idx = (Math.random() * STYLE_COUNT) | 0;
  if (idx === except) idx = (idx + 1) % STYLE_COUNT;
  return idx;
}

/** Append a style marker to a share path fragment. */
export function withStyleMarker(fragment: string, styleIndex: number): string {
  return `${fragment}/s${((styleIndex % STYLE_COUNT) + STYLE_COUNT) % STYLE_COUNT}`;
}

/** Split '/s<index>' off a share payload path — returns clean payload + style. */
export function splitStyleMarker(payload: string): { clean: string; style: DropStyle | null } {
  const m = payload.match(/^(.*)\/s(\d+)$/);
  if (!m) return { clean: payload, style: null };
  return { clean: m[1], style: styleAt(Number(m[2])) };
}

/** CSS variable tokens for a style, ready to spread on a wrapper element. */
export function styleTokens(s: DropStyle): Record<string, string> {
  return {
    '--sd-c1': s.palette.c1,
    '--sd-c2': s.palette.c2,
    '--sd-c3': s.palette.c3,
    '--sd-grad': `linear-gradient(120deg, ${s.palette.c1}, ${s.palette.c3} 50%, ${s.palette.c2})`
  };
}
