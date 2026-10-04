// VOTE OUT IMPOSTER — core game engine. Pure, synchronous, deterministic when
// seeded with an rng; the UI and both transports (pass-and-play + WebRTC room)
// sit on top of these functions. No rendering, no storage, no timers here.
import type { WordPick } from './words';

export type ChaosMode = 'off' | 'all' | 'none' | 'random' | 'custom';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'random';

export interface Player {
  id: string;
  name: string;
}

export interface GameSettings {
  players: Player[];
  /** 'random' or an explicit count 1..maxImposters(n). */
  imposters: number | 'random';
  chaos: ChaosMode;
  /** Custom count used when chaos === 'custom'. */
  chaosCustomCount: number;
  /** Optional related-word hint shown to imposters. User-requested off-switch exists. */
  imposterHint: boolean;
  categories: string[];
  difficulty: Difficulty;
  /** Discussion timer in seconds; 0 = off. */
  timerSec: number;
  /** Allow eliminated imposters one word-guess to steal the win. */
  imposterGuess: boolean;
  /** Number of back-to-back rounds to play. */
  rounds: number;
}

export interface RoleAssignment {
  playerId: string;
  isImposter: boolean;
  /** True when this player receives the secret word. */
  knowsWord: boolean;
  /** Optional related-word hint string, only when settings.imposterHint and chaos permits. */
  hint: string | null;
}

export interface VoteTally {
  counts: Record<string, number>;
  eliminatedId: string | null;
  tiedIds: string[];
  isTie: boolean;
}

export type Winner = 'innocents' | 'imposters' | 'chaos-none' | 'chaos-all' | 'steal';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 20;

export function maxImposters(n: number): number {
  // keeps at least (n - floor((n-1)/2)) innocents voting: imposters can never
  // already-outvote innocents at game start. 3 players -> 1, 5 -> 2, 9 -> 4.
  return Math.max(1, Math.floor((n - 1) / 2));
}

export function validateSettings(s: GameSettings): string[] {
  const errs: string[] = [];
  const n = s.players.length;
  if (n < MIN_PLAYERS) errs.push(`Need at least ${MIN_PLAYERS} players.`);
  if (n > MAX_PLAYERS) errs.push(`Max ${MAX_PLAYERS} players.`);
  const names = s.players.map((p) => p.name.trim().toLowerCase());
  if (s.players.some((p) => p.name.trim().length === 0)) errs.push('Every player needs a name.');
  if (new Set(names).size !== names.length) errs.push('No duplicate names in one game.');
  if (n >= MIN_PLAYERS && n <= MAX_PLAYERS) {
    if (s.chaos === 'custom') {
      if (s.chaosCustomCount < 1) errs.push('Custom chaos needs at least 1 imposter.');
      if (s.chaosCustomCount > maxImposters(n)) errs.push(`With ${n} players, max imposters is ${maxImposters(n)}.`);
    } else if (s.chaos !== 'all' && s.chaos !== 'none') {
      if (s.imposters === 'random') {
        // fine — resolved at assignment time within valid bounds
      } else if (s.imposters < 1 || s.imposters > maxImposters(n)) {
        errs.push(`With ${n} players, imposters must be 1–${maxImposters(n)}.`);
      }
    }
  }
  const cats = s.categories.filter((c) => c !== 'random');
  if (!s.categories.length) errs.push('Pick at least one category (or RANDOM).');
  void cats;
  if (s.rounds < 1 || s.rounds > 12) errs.push('Rounds must be between 1 and 12.');
  if (s.timerSec < 0) errs.push('Timer cannot be negative.');
  return errs;
}

function cryptoRng(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0xffffffff;
}

/**
 * Resolve how many imposters this round has, honoring chaos + settings.
 * Returns 0 for 'none', n for 'all'.
 */
export function resolveImposterCount(s: GameSettings, rng: () => number = cryptoRng): number {
  const n = s.players.length;
  const max = maxImposters(n);
  switch (s.chaos) {
    case 'all': return n;
    case 'none': return 0;
    case 'custom': return Math.min(s.chaosCustomCount, max);
    case 'random':
    case 'off': {
      if (s.chaos === 'random' || s.imposters === 'random') {
        return 1 + Math.floor(rng() * max);
      }
      return Math.min(Math.max(1, Number(s.imposters)), max);
    }
  }
}

export function assignRoles(
  players: Player[],
  count: number,
  chaos: ChaosMode,
  hintFor: () => string | null,
  rng: () => number = cryptoRng
): RoleAssignment[] {
  const n = players.length;
  if (chaos === 'all') {
    return players.map((p) => ({ playerId: p.id, isImposter: true, knowsWord: false, hint: null }));
  }
  if (chaos === 'none') {
    return players.map((p) => ({ playerId: p.id, isImposter: false, knowsWord: true, hint: null }));
  }
  const order = players.map((_, i) => i);
  // Fisher–Yates
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const imp = new Set(order.slice(0, count));
  return players.map((p, i) => ({
    playerId: p.id,
    isImposter: imp.has(i),
    knowsWord: !imp.has(i),
    hint: imp.has(i) ? hintFor() : null
  }));
}

/**
 * Tally a round of votes. voters → targetIds; guards against duplicates
 * (impossible by construction), self-votes are rejected at input time.
 * Returns { eliminatedId } = the strict plurality winner, or a tie marker.
 */
export function tallyVotes(alive: string[], votes: Record<string, string>): VoteTally {
  const counts: Record<string, number> = {};
  for (const id of alive) counts[id] = 0;
  for (const [voter, target] of Object.entries(votes)) {
    if (!alive.includes(voter) || !alive.includes(target) || voter === target) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const entries = alive.map((id) => [id, counts[id] ?? 0] as const).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  const tied = entries.filter(([, c]) => c === top[1]).map(([id]) => id);
  return {
    counts,
    eliminatedId: tied.length === 1 && top[1] > 0 ? top[0] : null,
    tiedIds: tied.length > 1 ? tied : [],
    isTie: tied.length > 1 || top[1] === 0
  };
}

/**
 * Win condition, post-elimination. Innocents win when no imposters remain.
 * Imposters win when they can no longer be outvoted (imposters >= innocents alive).
 */
export function winCheck(aliveImposters: number, aliveInnocents: number): Winner | null {
  if (aliveImposters === 0) return 'innocents';
  if (aliveImposters >= aliveInnocents) return 'imposters';
  return null;
}

/* --------------------------- statistics (current game) -------------------- */

export interface PlayerStats {
  id: string;
  name: string;
  games: number;
  imposterWins: number;
  innocentWins: number;
  votesReceived: number;
  timesVotedOut: number;
  timesImposter: number;
  successfulGuesses: number;
}

export function emptyStats(players: Player[]): PlayerStats[] {
  return players.map((p) => ({
    id: p.id, name: p.name, games: 0, imposterWins: 0, innocentWins: 0,
    votesReceived: 0, timesVotedOut: 0, timesImposter: 0, successfulGuesses: 0
  }));
}

export function recordRoundEnd(stats: PlayerStats[], assignments: RoleAssignment[], winner: Winner): PlayerStats[] {
  const imps = new Set(assignments.filter((a) => a.isImposter).map((a) => a.playerId));
  return stats.map((s) => {
    const wasImposter = imps.has(s.id);
    const imposterSideWon = winner === 'imposters' || winner === 'steal' || winner === 'chaos-all';
    const innocentSideWon = winner === 'innocents' || winner === 'chaos-none';
    return {
      ...s,
      games: s.games + 1,
      timesImposter: s.timesImposter + (wasImposter ? 1 : 0),
      imposterWins: s.imposterWins + (wasImposter && imposterSideWon ? 1 : 0),
      innocentWins: s.innocentWins + (!wasImposter && innocentSideWon ? 1 : 0)
    };
  });
}

export function recordVoteOutcome(stats: PlayerStats[], tally: VoteTally): PlayerStats[] {
  return stats.map((s) => ({
    ...s,
    votesReceived: s.votesReceived + (tally.counts[s.id] ?? 0),
    timesVotedOut: s.timesVotedOut + (tally.eliminatedId === s.id ? 1 : 0)
  }));
}

export function mostVoted(stats: PlayerStats[]): PlayerStats | null {
  if (!stats.length) return null;
  return [...stats].sort((a, b) => b.votesReceived - a.votesReceived)[0];
}

export function bestImposter(stats: PlayerStats[]): PlayerStats | null {
  const ranked = [...stats].sort((a, b) => b.imposterWins - a.imposterWins);
  return ranked.length && ranked[0].imposterWins > 0 ? ranked[0] : null;
}
