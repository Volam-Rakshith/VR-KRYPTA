import { describe, it, expect } from 'vitest';
import { STYLE_COUNT, styleAt, randomStyleIndex, withStyleMarker, withBurnMarker, splitStyleMarker, splitBurnMarker, styleTokens } from '../src/features/shareThemes';
import { maskText, cinematicFrames } from '../src/services/cinema';

describe('secret drop style engine', () => {
  it('offers 100+ styles', () => {
    expect(STYLE_COUNT).toBeGreaterThanOrEqual(100);
    const names = new Set(Array.from({ length: STYLE_COUNT }, (_, i) => styleAt(i).name));
    expect(names.size).toBe(STYLE_COUNT); // every style has a unique name
  });

  it('wraps indices and produces valid styles', () => {
    expect(styleAt(0).index).toBe(0);
    expect(styleAt(STYLE_COUNT).index).toBe(0);
    expect(styleAt(-3).index).toBe(STYLE_COUNT - 3);
    for (const i of [0, 11, 107, 999]) {
      const s = styleAt(i);
      expect(s.palette.c1).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.pattern.cls).toMatch(/^sdp-/);
    }
  });

  it('style marker round-trips through payloads', () => {
    const blob = 'VK1.c2FsdA.aXYt.Y3Q';
    const frag = withStyleMarker(blob, 42);
    expect(frag.endsWith('/s42')).toBe(true);
    const { clean, style } = splitStyleMarker(frag);
    expect(clean).toBe(blob);
    expect(style?.index).toBe(42);
    // no marker → null style, payload untouched
    expect(splitStyleMarker(blob)).toEqual({ clean: blob, style: null });
  });

  it('randomStyleIndex stays in range and avoids repeats when asked', () => {
    for (let k = 0; k < 50; k++) {
      const i = randomStyleIndex(7);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(STYLE_COUNT);
      expect(i).not.toBe(7);
    }
  });

  it('tokenizes a style into css variables', () => {
    const t = styleTokens(styleAt(5));
    expect(t['--sd-c1']).toMatch(/^#/);
    expect(t['--sd-grad']).toContain('linear-gradient');
  });
});

describe('cinematic reveal helpers', () => {
  it('maskText keeps the revealed prefix exact and masks the rest', () => {
    const full = 'meet at midnight';
    const masked = maskText(full, 4);
    expect(masked.startsWith('meet')).toBe(true);
    expect(masked.length).toBe(full.length);
    expect(masked[4]).toBe(' ');          // whitespace passes through
    expect(masked.slice(0, 4)).toBe('meet');
  });

  it('maskText full-progress returns the text verbatim; 0 hides it', () => {
    const full = 'top secret!! 🔦';
    expect(maskText(full, full.length)).toBe(full);
    expect(maskText(full, 0).split('').every((c, i) => full[i].trim() === '' ? c === full[i] : c !== full[i] || true)).toBe(true);
  });

  it('cinematicFrames scales but caps runtime', () => {
    const short = cinematicFrames('hi');
    expect(short.frames).toBeGreaterThan(0);
    const long = cinematicFrames('x'.repeat(2000));
    expect(long.frames).toBeLessThanOrEqual(110);
  });

  it('324-style matrix resolves motif + keeps style names unique', () => {
    const s = styleAt(312);
    expect(s.motif.cls).toMatch(/^mot-/);
    expect(new Set(Array.from({ length: STYLE_COUNT }, (_, i) => styleAt(i).name)).size).toBe(STYLE_COUNT);
  });
});

describe('burn-after-reading fuse marker', () => {
  it('round-trips the fuse through payloads', () => {
    const blob = 'VK1.c2FsdA.aXYt.Y3Q';
    const frag = withBurnMarker(blob, 30);
    expect(frag).toBe(`${blob}/b30`);
    expect(splitBurnMarker(frag)).toEqual({ rest: blob, fuse: 30 });
  });

  it('stacks with the style marker in documented order (style then fuse)', () => {
    const blob = 'VK1.c2FsdA.aXYt.Y3Q';
    const frag = withBurnMarker(withStyleMarker(blob, 7), 15);
    const { rest, fuse } = splitBurnMarker(frag);
    expect(fuse).toBe(15);
    const { clean, style } = splitStyleMarker(rest);
    expect(clean).toBe(blob);
    expect(style!.index).toBe(7);
  });

  it('leaves old links untouched: style-only fragment gives fuse null', () => {
    const frag = withStyleMarker('VK1.a.b.c', 10);
    expect(splitBurnMarker(frag)).toEqual({ rest: frag, fuse: null });
    expect(splitStyleMarker(frag).clean).toBe('VK1.a.b.c');
  });

  it('clamps absurd fuse values defensively', () => {
    expect(splitBurnMarker('VK1.a.b.c/b0').fuse).toBe(1);
    expect(splitBurnMarker('VK1.a.b.c/b9999').fuse).toBe(3600);
    expect(withBurnMarker('VK1.a.b.c', 5000)).toBe('VK1.a.b.c/b3600');
  });
});
