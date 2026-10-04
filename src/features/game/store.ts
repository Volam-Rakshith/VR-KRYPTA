// Local persistence for VOTE OUT IMPOSTER — recent player names, last settings,
// completed-game snapshot (for instant replay), unfinished-session restore,
// per-player cumulative stats, recent-word avoidance, and sound prefs.
// No accounts. Everything stays in this browser. Falls back to an in-memory
// Map when localStorage is unavailable (tests, private mode).
import type { GameSettings, PlayerStats } from './engine';

const memory = new Map<string, string>();

function hasLS(): boolean {
  try {
    const k = '__voi_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function getItem(key: string): string | null {
  if (hasLS()) return localStorage.getItem(key);
  return memory.get(key) ?? null;
}

function setItem(key: string, value: string): void {
  if (hasLS()) localStorage.setItem(key, value);
  else memory.set(key, value);
}

function read<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  setItem(key, JSON.stringify(value));
}

const K = {
  recentPlayers: 'voi.recentPlayers',
  lastSettings: 'voi.lastSettings',
  session: 'voi.session',
  lastGame: 'voi.lastGame',
  stats: 'voi.stats',
  recentWords: 'voi.recentWords',
  sound: 'voi.sound'
} as const;

/* ------------------------------ player names ------------------------------ */

const MAX_RECENT = 30;

export function getRecentPlayers(): string[] {
  return read<string[]>(K.recentPlayers, []);
}

export function pushRecentPlayers(names: string[]): void {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  const existing = getRecentPlayers().filter((n) => !cleaned.some((c) => c.toLowerCase() === n.toLowerCase()));
  write(K.recentPlayers, [...cleaned, ...existing].slice(0, MAX_RECENT));
}

/* ------------------------------ last settings ----------------------------- */

export function saveLastSettings(settings: GameSettings): void {
  write(K.lastSettings, settings);
}

export function getLastSettings(): GameSettings | null {
  return read<GameSettings | null>(K.lastSettings, null);
}

/* ------------------------------ session restore --------------------------- */

export interface SessionSnapshot {
  phase: string;
  settings: GameSettings;
  payload: Record<string, unknown>;
  savedAt: number;
}

export function saveSession(snapshot: SessionSnapshot): void {
  write(K.session, snapshot);
}

export function getSession(): SessionSnapshot | null {
  return read<SessionSnapshot | null>(K.session, null);
}

export function clearSession(): void {
  if (hasLS()) localStorage.removeItem(K.session);
  else memory.delete(K.session);
}

/* ------------------------------ last completed game ----------------------- */

export function saveLastGame(settings: GameSettings): void {
  write(K.lastGame, { settings, finishedAt: Date.now() });
}

export function getLastGame(): { settings: GameSettings; finishedAt: number } | null {
  return read<{ settings: GameSettings; finishedAt: number } | null>(K.lastGame, null);
}

/* ------------------------------ player statistics ------------------------- */

export function getStats(): PlayerStats[] {
  return read<PlayerStats[]>(K.stats, []);
}

export function recordGameStats(perGame: PlayerStats[]): PlayerStats[] {
  const all = getStats();
  const byId = new Map(all.map((s) => [s.id, s]));
  for (const s of perGame) {
    const prev = byId.get(s.id);
    if (!prev) {
      byId.set(s.id, { ...s });
    } else {
      byId.set(s.id, {
        ...prev,
        games: prev.games + s.games,
        imposterWins: prev.imposterWins + s.imposterWins,
        innocentWins: prev.innocentWins + s.innocentWins,
        votesReceived: prev.votesReceived + s.votesReceived,
        timesVotedOut: prev.timesVotedOut + s.timesVotedOut,
        timesImposter: prev.timesImposter + s.timesImposter,
        successfulGuesses: prev.successfulGuesses + s.successfulGuesses
      });
    }
  }
  const merged = [...byId.values()];
  write(K.stats, merged);
  return merged;
}

/* ------------------------------ recent words ------------------------------ */

export function getRecentWords(): string[] {
  return read<string[]>(K.recentWords, []);
}

export function pushRecentWord(id: string, limit: number): void {
  const list = getRecentWords().filter((w) => w !== id);
  list.push(id);
  write(K.recentWords, list.slice(-limit));
}

/* ------------------------------ sound prefs ------------------------------- */

export interface SoundPrefs {
  music: boolean;
  sfx: boolean;
  volume: number; // 0..100
}

export function getSoundPrefs(): SoundPrefs {
  return read<SoundPrefs>(K.sound, { music: true, sfx: true, volume: 60 });
}

export function saveSoundPrefs(p: SoundPrefs): void {
  write(K.sound, p);
}
