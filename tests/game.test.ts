import { describe, it, expect } from 'vitest';
import {
  validateSettings, resolveImposterCount, assignRoles, tallyVotes, winCheck,
  maxImposters, emptyStats, recordRoundEnd, recordVoteOutcome, mostVoted, bestImposter,
  GameSettings, Player
} from '../src/features/game/engine';
import { CATEGORIES, pickWord, imposterHintWord, expandCategories, RECENT_WORD_LIMIT } from '../src/features/game/words';

function seqRng(step: number) {
  let i = 0;
  return () => {
    const v = (0.1234567 + i * step) % 1;
    i++;
    return v;
  };
}

function mkPlayers(...names: string[]): Player[] {
  return names.map((n, i) => ({ id: 'p' + (i + 1), name: n }));
}

function baseSettings(players: Player[]): GameSettings {
  return {
    players,
    imposters: 1,
    chaos: 'off',
    chaosCustomCount: 1,
    imposterHint: true,
    categories: ['random'],
    difficulty: 'easy',
    timerSec: 0,
    imposterGuess: true,
    rounds: 3
  };
}

describe('word database', () => {
  it('has all required categories (incl. india, memes, famous folks)', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const req of ['food', 'people', 'everyday', 'transport', 'education', 'technology', 'sports', 'places', 'entertainment', 'animals', 'nature', 'events', 'india', 'memes', 'famous']) {
      expect(ids, `category ${req} missing`).toContain(req);
    }
  });

  it('has a big library — hundreds of words, no placeholders', () => {
    const total = CATEGORIES.reduce((n, c) => n + c.words.easy.length + c.words.normal.length + c.words.hard.length, 0);
    expect(total).toBeGreaterThan(900);
    for (const c of CATEGORIES) {
      expect(c.words.easy.length, `${c.id} easy`).toBeGreaterThanOrEqual(10);
      expect(c.words.normal.length, `${c.id} normal`).toBeGreaterThanOrEqual(10);
    }
  });

  it('keeps ordinary words everyday-friendly', () => {
    const food = CATEGORIES.find((c) => c.id === 'food')!;
    expect(food.words.easy).toContain('Pizza');
    const india = CATEGORIES.find((c) => c.id === 'india')!;
    expect(india.words.easy.join(' ')).toMatch(/Chai|Cricket|Metro/);
    const memes = CATEGORIES.find((c) => c.id === 'memes')!;
    expect(memes.words.easy.join(' ')).toContain('fahhhhhhhhh');
  });

  it('random category means all categories participate', () => {
    expect(expandCategories(['random'])).toHaveLength(CATEGORIES.length);
    expect(expandCategories(['food'])).toHaveLength(1);
    expect(expandCategories([])).toHaveLength(CATEGORIES.length);
  });

  it('avoids recent words and resets when the pool runs dry', () => {
    const recent: string[] = [];
    const cat = CATEGORIES.find((c) => c.id === 'animals')!;
    const pool = [...cat.words.easy];
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const w = pickWord(['animals'], 'easy', recent, seqRng(0.373));
      if (seen.has(w.id)) break; // pool reset eventually ok
      seen.add(w.id);
      recent.push(w.id);
      if (recent.length > RECENT_WORD_LIMIT) recent.shift();
    }
    expect(seen.size).toBeGreaterThanOrEqual(Math.min(10, pool.length));
  });

  it('difficulty tiers + random tier picks real words', () => {
    const w1 = pickWord(['food'], 'easy', [], seqRng(0.5));
    expect(w1.tier).toBe('easy');
    const w2 = pickWord(['random'], 'random', [], seqRng(0.51));
    expect(['easy', 'normal', 'hard']).toContain(w2.tier);
  });

  it('imposter hint is a sibling, never the word', () => {
    for (let i = 0; i < 30; i++) {
      const w = pickWord(['food'], 'easy', [], seqRng(0.41));
      const hint = imposterHintWord(w, seqRng(0.42));
      expect(hint).not.toBe(w.word);
      expect(CATEGORIES.find((c) => c.id === w.categoryId)!.words.easy).toContain(hint);
    }
  });
});

describe('settings validation', () => {
  it('rejects too few players & impossible imposter counts', () => {
    expect(validateSettings(baseSettings(mkPlayers('A', 'B'))).join(' ')).toMatch(/at least 3/);
    const three = baseSettings(mkPlayers('A', 'B', 'C'));
    three.imposters = 3;
    expect(validateSettings(three).join(' ')).toMatch(/imposters must be 1–1/);
    const five = baseSettings(mkPlayers('A', 'B', 'C', 'D', 'E'));
    five.imposters = 2;
    expect(validateSettings(five)).toHaveLength(0);
    five.chaos = 'custom';
    five.chaosCustomCount = 7;
    expect(validateSettings(five).join(' ')).toMatch(/max imposters is 2/);
  });

  it('rejects duplicate names and empty categories', () => {
    const s = baseSettings(mkPlayers('A', 'a', 'C'));
    expect(validateSettings(s).join(' ')).toMatch(/duplicate/);
    const s2 = baseSettings(mkPlayers('A', 'B', 'C'));
    s2.categories = [];
    expect(validateSettings(s2).join(' ')).toMatch(/category/);
  });

  it('maxImposters keeps innocents majority', () => {
    expect(maxImposters(3)).toBe(1);
    expect(maxImposters(5)).toBe(2);
    expect(maxImposters(10)).toBe(4);
  });
});

describe('role assignment & chaos', () => {
  it('assigns exactly N imposters, everyone else knows the word', () => {
    const players = mkPlayers('A', 'B', 'C', 'D', 'E');
    const asg = assignRoles(players, 2, 'off', () => 'HINT', seqRng(0.31));
    expect(asg.filter((a) => a.isImposter)).toHaveLength(2);
    expect(asg.filter((a) => a.knowsWord)).toHaveLength(3);
    for (const a of asg.filter((a) => a.isImposter)) expect(a.hint).toBe('HINT');
  });

  it('chaos ALL: every player imposter, nobody knows the word', () => {
    const players = mkPlayers('A', 'B', 'C');
    const asg = assignRoles(players, 3, 'all', () => null, seqRng(0.31));
    expect(asg.every((a) => a.isImposter && !a.knowsWord)).toBe(true);
  });

  it('chaos NONE: nobody imposter, everyone gets the word', () => {
    const asg = assignRoles(mkPlayers('A', 'B', 'C', 'D'), 0, 'none', () => null, seqRng(0.31));
    expect(asg.every((a) => !a.isImposter && a.knowsWord)).toBe(true);
  });

  it('random imposter count stays within valid bounds', () => {
    const players = mkPlayers('A', 'B', 'C', 'D', 'E', 'F');
    for (let i = 0; i < 40; i++) {
      const s = baseSettings(players);
      s.chaos = 'random';
      const n = resolveImposterCount(s, seqRng(0.007 + i * 0.013));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2); // maxImposters(6) = 2
    }
  });

  it('custom chaos count honored & clamped', () => {
    const players = mkPlayers('A', 'B', 'C', 'D', 'E');
    const s = baseSettings(players);
    s.chaos = 'custom';
    s.chaosCustomCount = 2;
    expect(resolveImposterCount(s, seqRng(0.1))).toBe(2);
    s.chaosCustomCount = 9;
    expect(resolveImposterCount(s, seqRng(0.1))).toBe(2); // clamped to max
  });
});

describe('voting', () => {
  const alive = ['p1', 'p2', 'p3', 'p4'];

  it('strict plurality eliminates; self-votes and ghosts ignored', () => {
    const t = tallyVotes(alive, { p1: 'p2', p2: 'p3', p3: 'p2', p4: 'p2', p4_self: 'p2' });
    expect(t.eliminatedId).toBe('p2');
    expect(t.isTie).toBe(false);
    expect(t.counts.p2).toBe(3);
  });

  it('ties produce NO elimination and trigger revote flow', () => {
    const t = tallyVotes(alive, { p1: 'p2', p2: 'p1', p3: 'p4', p4: 'p3' });
    expect(t.isTie).toBe(true);
    expect(t.eliminatedId).toBeNull();
    expect(t.tiedIds.sort()).toEqual(['p1', 'p2', 'p3', 'p4'].sort());
  });

  it('self-voting is rejected by the guard', () => {
    const t = tallyVotes(alive, { p1: 'p1', p2: 'p3', p3: 'p2', p4: 'p3' });
    expect(t.counts.p1).toBe(0);
    expect(t.eliminatedId).toBe('p3');
  });
});

describe('win conditions', () => {
  it('innocents win when last imposter dies', () => {
    expect(winCheck(0, 3)).toBe('innocents');
  });
  it('imposters win when innocents can no longer outvote', () => {
    expect(winCheck(2, 2)).toBe('imposters');
    expect(winCheck(1, 1)).toBe('imposters');
  });
  it('game continues while innocents retain majority', () => {
    expect(winCheck(1, 3)).toBeNull();
    expect(winCheck(2, 5)).toBeNull();
  });
});

describe('stats keeping', () => {
  it('tracks games, votes, sides', () => {
    const players = mkPlayers('A', 'B', 'C', 'D');
    let stats = emptyStats(players);
    const asg = assignRoles(players, 1, 'off', () => null, seqRng(0.1));
    const impId = asg.find((a) => a.isImposter)!.playerId;
    const tally = tallyVotes(players.map((p) => p.id), { p1: impId, p2: impId, p3: impId, p4: impId });
    stats = recordVoteOutcome(stats, tally);
    stats = recordRoundEnd(stats, asg, 'innocents');
    const imp = stats.find((s) => s.id === impId)!;
    expect(imp.games).toBe(1);
    expect(imp.timesImposter).toBe(1);
    expect(imp.timesVotedOut).toBe(1);
    expect(imp.votesReceived).toBe(players.length - 1);
    const innocent = stats.find((s) => s.id !== impId)!;
    expect(innocent.innocentWins).toBe(1);
    expect(mostVoted(stats)!.id).toBe(impId);
  });

  it('bestImposter only appears when imposters actually won something', () => {
    const players = mkPlayers('A', 'B', 'C');
    const stats = emptyStats(players);
    expect(bestImposter(stats)).toBeNull();
    const asg = assignRoles(players, 1, 'off', () => null, seqRng(0.1));
    const won = recordRoundEnd(stats, asg, 'imposters');
    expect(bestImposter(won)!.id).toBe(asg.find((a) => a.isImposter)!.playerId);
  });
});
