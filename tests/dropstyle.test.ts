import { describe, it, expect } from 'vitest';
import { STYLE_COUNT, styleAt, randomStyleIndex, withStyleMarker, splitStyleMarker, styleTokens } from '../src/features/shareThemes';

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
