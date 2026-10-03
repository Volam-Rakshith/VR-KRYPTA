// Lazy Pyodide bridge. The runtime (~10 MB from CDN) is fetched ONLY when the
// user first runs a Python-backed operation, then reused for the session and
// cached by the service worker on subsequent visits.
import PythonWorker from '../workers/python.worker?worker';

export type PythonState = 'idle' | 'loading' | 'ready' | 'unavailable';

let worker: Worker | null = null;
let state: PythonState = 'idle';
let initPromise: Promise<void> | null = null;
let callId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const listeners = new Set<(s: PythonState) => void>();

export function onPythonState(fn: (s: PythonState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(s: PythonState) {
  state = s;
  for (const fn of listeners) fn(s);
}

export function pythonState(): PythonState {
  return state;
}

interface WorkerResult {
  type: 'ready' | 'result';
  id: number;
  payload?: { ok: boolean; text?: string; error?: string };
  initError?: boolean;
}

function ensureWorker(): Promise<void> {
  if (state === 'ready') return Promise.resolve();
  if (initPromise) return initPromise;
  setState('loading');
  initPromise = new Promise<void>((resolve, reject) => {
    try {
      worker = new PythonWorker();
    } catch (e) {
      setState('unavailable');
      reject(e as Error);
      return;
    }
    worker.onmessage = (ev: MessageEvent<WorkerResult>) => {
      const msg = ev.data;
      if (msg.type === 'ready') {
        setState('ready');
        resolve();
        return;
      }
      if (msg.initError) {
        setState('unavailable');
        reject(new Error(msg.payload?.error ?? 'Failed to start the Python runtime.'));
        return;
      }
      if (msg.type === 'result') {
        const entry = pending.get(msg.id);
        if (!entry) return;
        pending.delete(msg.id);
        if (msg.payload?.ok) entry.resolve(msg.payload.text ?? '');
        else entry.reject(new Error(msg.payload?.error ?? 'Python call failed.'));
      }
    };
    worker.onerror = () => {
      setState('unavailable');
      reject(new Error('Python runtime failed to load. Python-backed operations need a one-time ~10 MB download; check your connection and retry.'));
    };
    worker!.postMessage({ type: 'init', id: -1 });
  });
  initPromise.catch(() => undefined);
  return initPromise;
}

/** Fire-and-forget warmup (used by UI hints). */
export function warmPython(): void {
  void ensureWorker().then(() => undefined, () => undefined);
}

/** Descriptive text for the Settings page about runtime caching. */
export function clearPythonCacheHint(): string {
  return 'The Pyodide Python runtime (downloaded once for “python” operations) is cached by the service worker and cleared separately via your browser’s site-data settings.';
}

export async function callPython<T = string>(fn: string, args: Record<string, unknown>): Promise<T> {
  try {
    await ensureWorker();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
  const id = ++callId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker!.postMessage({ type: 'call', id, fn, args });
  });
}
