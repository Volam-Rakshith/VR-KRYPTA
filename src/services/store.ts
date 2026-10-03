// Local-first persistence.
//   localStorage  → small preferences (display name, theme flags)
//   IndexedDB     → structured data (favorites, history, saved pipelines)
// Everything is wrapped so components never touch raw storage APIs, and every
// failure mode (quota, corruption, private mode) degrades gracefully.

import type { OperationDefinition } from '../operations/core/types';

/* ------------------------------ preferences ------------------------------ */

export interface Prefs {
  name: string | null;
  welcomed: boolean;
  bootSeen: boolean;
  motionFx: boolean; // ambient cursor/particle layers
  glowFx: boolean;   // hover glow layers
}

const PREFS_KEY = 'vrk:prefs';

const defaultPrefs: Prefs = {
  name: null,
  welcomed: false,
  bootSeen: false,
  motionFx: true,
  glowFx: true
};

let prefs: Prefs = { ...defaultPrefs };
const listeners = new Set<() => void>();

function notify() {
  // Re-identity the snapshot so useSyncExternalStore consumers re-render —
  // mutating arrays in place left React comparing the same reference.
  data = { ...data };
  prefs = { ...prefs };
  for (const fn of listeners) fn();
}

export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* corrupted prefs → defaults */
  }
  return { ...defaultPrefs };
}

export function getPrefs(): Prefs {
  return prefs;
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable (private mode) — session-only prefs */
  }
  notify();
}

/* -------------------------------- IndexedDB ------------------------------- */

export interface HistoryEntry {
  id?: number;
  ts: number;
  opId: string;
  opName: string;
  actionLabel: string;
  inputPreview: string;
  outputPreview: string;
  /** Full payloads for one-click replay (capped, optional for old entries). */
  actionId?: string;
  input?: string;
  output?: string;
  options?: Record<string, unknown>;
}

export interface PipelineStep {
  opId: string;
  actionId: string;
  options: Record<string, unknown>;
  enabled: boolean;
}

export interface SavedPipeline {
  id: string;
  name: string;
  steps: PipelineStep[];
  updatedAt: number;
}

const DB_NAME = 'vr-krypta';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = {
  favorites: new Set<string>(),
  history: [] as HistoryEntry[],
  pipelines: new Map<string, SavedPipeline>()
};

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('favorites')) db.createObjectStore('favorites', { keyPath: 'opId' });
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains('pipelines')) db.createObjectStore('pipelines', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  if (!db) {
    if (store === 'favorites') return [...memoryFallback.favorites].map((opId) => ({ opId }) as T);
    if (store === 'history') return memoryFallback.history as T[];
    return [...memoryFallback.pipelines.values()] as T[];
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut(store: string, value: unknown): Promise<void> {
  const db = await openDB();
  if (!db) {
    const v = value as { opId?: string; id?: string };
    if (store === 'favorites') memoryFallback.favorites.add(v.opId!);
    else if (store === 'history') memoryFallback.history.unshift(value as HistoryEntry);
    else if (store === 'pipelines') memoryFallback.pipelines.set(v.id!, value as SavedPipeline);
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  if (!db) {
    if (store === 'favorites') memoryFallback.favorites.delete(String(key));
    else if (store === 'history') memoryFallback.history = memoryFallback.history.filter((h) => h.id !== key);
    else memoryFallback.pipelines.delete(String(key));
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbClear(store: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    if (store === 'favorites') memoryFallback.favorites.clear();
    else if (store === 'history') memoryFallback.history = [];
    else memoryFallback.pipelines.clear();
    return;
  }
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ------------------------------- app state -------------------------------- */

export interface AppData {
  favorites: string[];
  history: HistoryEntry[];
  pipelines: SavedPipeline[];
}

let data: AppData = { favorites: [], history: [], pipelines: [] };

export function getData(): AppData {
  return data;
}

export async function initStore(): Promise<void> {
  prefs = loadPrefs();
  const [favs, hist, pipes] = await Promise.all([
    idbAll<{ opId: string }>('favorites'),
    idbAll<HistoryEntry>('history'),
    idbAll<SavedPipeline>('pipelines')
  ]);
  data = {
    favorites: favs.map((f) => f.opId),
    history: hist.sort((a, b) => b.ts - a.ts).slice(0, 100),
    pipelines: pipes.sort((a, b) => b.updatedAt - a.updatedAt)
  };
  notify();
}

export function isFavorite(opId: string): boolean {
  return data.favorites.includes(opId);
}

export async function toggleFavorite(op: OperationDefinition): Promise<boolean> {
  const fav = !isFavorite(op.id);
  if (fav) {
    data.favorites = [...data.favorites, op.id];
    await idbPut('favorites', { opId: op.id });
  } else {
    data.favorites = data.favorites.filter((x) => x !== op.id);
    await idbDelete('favorites', op.id);
  }
  notify();
  return fav;
}

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'ts'>): Promise<void> {
  const rec: HistoryEntry = { ...entry, ts: Date.now() };
  await idbPut('history', rec);
  data.history = [rec, ...data.history].slice(0, 100);
  notify();
}

export async function clearHistory(): Promise<void> {
  data.history = [];
  await idbClear('history');
  notify();
}

export async function clearFavorites(): Promise<void> {
  data.favorites = [];
  await idbClear('favorites');
  notify();
}

export async function savePipeline(p: SavedPipeline): Promise<void> {
  const rec = { ...p, updatedAt: Date.now() };
  await idbPut('pipelines', rec);
  const i = data.pipelines.findIndex((x) => x.id === p.id);
  if (i >= 0) data.pipelines[i] = rec;
  else data.pipelines = [rec, ...data.pipelines];
  data.pipelines.sort((a, b) => b.updatedAt - a.updatedAt);
  notify();
}

export async function deletePipeline(id: string): Promise<void> {
  data.pipelines = data.pipelines.filter((p) => p.id !== id);
  await idbDelete('pipelines', id);
  notify();
}

export async function clearAllData(): Promise<void> {
  data = { favorites: [], history: [], pipelines: [] };
  await Promise.all([idbClear('favorites'), idbClear('history'), idbClear('pipelines')]);
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch { /* ignore */ }
  prefs = { ...defaultPrefs };
  notify();
}
