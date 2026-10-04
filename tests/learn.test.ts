import { describe, it, expect } from 'vitest';
import '../src/operations';
import { learnCard, learnExamples, learnIds, CURATED } from '../src/services/learn';
import { getOp, allOps } from '../src/operations/core/registry';

describe('learn mode — cards', () => {
  it('serves a curated deep dive for flagship ops', () => {
    const card = learnCard('morse')!;
    expect(card.curated).toBe(true);
    expect(card.what.length).toBeGreaterThan(60);
    expect(card.howSteps.length).toBeGreaterThanOrEqual(4);
    expect(card.history).toContain('telegraph');
    expect(card.security.length).toBeGreaterThan(40);
    expect(card.uses.length).toBeGreaterThanOrEqual(3);
    expect(card.limits.length).toBeGreaterThanOrEqual(2);
  });

  it('serves honest auto profiles for uncurated ops', () => {
    const card = learnCard('base85')!; // not in CURATED
    expect(card.curated).toBe(false);
    expect(card.what.length).toBeGreaterThan(10);
    expect(card.howSteps.length).toBeGreaterThanOrEqual(3);
    expect(card.history.length).toBeGreaterThan(40); // category-level, no invented dates
    expect(card.security.length).toBeGreaterThan(40);
    expect(card.uses).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('auto profiles include op warnings and one-way/lossy notes as limits', () => {
    const hash = learnCard('sha256')!; // curated, but check an uncurated hash
    expect(hash.curated).toBe(true);
    const crypto = learnCard('sha384')!;
    expect(crypto.curated).toBe(false);
    expect(crypto.oneWay).toBe(true);
    expect(crypto.limits.some((l) => /one-way/i.test(l))).toBe(true);
  });

  it('every curated id maps to a real registered op', () => {
    for (const id of Object.keys(CURATED)) {
      expect(getOp(id), `CURATED op id ${id} must exist`).toBeDefined();
    }
  });

  it('every op in the registry has a learn card', () => {
    for (const op of allOps()) {
      const card = learnCard(op.id);
      expect(card, `missing learn card for ${op.id}`).not.toBeNull();
      expect(card!.what.length).toBeGreaterThan(0);
      expect(card!.security.length).toBeGreaterThan(0);
    }
  });

  it('unknown ids return null', () => {
    expect(learnCard('not-a-real-op')).toBeNull();
    expect(learnCard('')).toBeNull();
  });

  it('learnIds covers the whole registry', () => {
    expect(learnIds().length).toBe(allOps().length);
  });
});

describe('learn mode — live examples', () => {
  it('computes a real morse example', async () => {
    const ex = await learnExamples('morse');
    expect(ex.length).toBeGreaterThanOrEqual(1);
    expect(ex[0].output).toContain('-');
    const roundTrip = ex.find((e) => e.label.includes('round trip'));
    expect(roundTrip).toBeDefined();
    expect(roundTrip!.output.toUpperCase()).toContain('SOS');
  });

  it('computes real caesar cipher output', async () => {
    const ex = await learnExamples('caesar');
    expect(ex[0].err).toBeFalsy();
    expect(ex[0].output).not.toBe(ex[0].input);
  });

  it('shows 64-hex digest for sha256', async () => {
    const ex = await learnExamples('sha256');
    expect(ex[0].err).toBeFalsy();
    expect(ex[0].output).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never crashes on python-engine ops — shows the runtime note', async () => {
    const ex = await learnExamples('sha3-256'); // python engine
    expect(ex.length).toBeGreaterThanOrEqual(1);
    expect(ex[0].err).toBe(true);
    expect(ex[0].output.toLowerCase()).toContain('python');
  });

  it('every registered op produces examples without throwing', async () => {
    for (const id of ['binary-text', 'a1z26', 'baconian', 'playfair', 'hex-text', 'gzip', 'atbash', 'vigenere', 'rot13']) {
      const ex = await learnExamples(id);
      expect(ex.length, `no examples for ${id}`).toBeGreaterThanOrEqual(1);
      expect(ex[0].err, `example for ${id} errored: ${ex[0].output}`).toBeFalsy();
    }
  });
});
