// Hash routing + reactive access to the local data store.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getData, getPrefs, subscribeStore } from '../services/store';
import type { AppData, Prefs } from '../services/store';

export interface Route {
  name: 'home' | 'explore' | 'op' | 'pipelines' | 'settings' | 'about' | 'share' | 'detect' | 'learn';
  param?: string;
}

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'explore') return { name: 'explore', param: parts[1] };
  if (parts[0] === 'op') return { name: 'op', param: decodeURIComponent(parts[1] ?? '') };
  if (parts[0] === 'pipelines') return { name: 'pipelines', param: parts[1] };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'about') return { name: 'about' };
  if (parts[0] === 'share') return { name: 'share', param: parts.slice(1).join('/') || undefined };
  if (parts[0] === 'detect') return { name: 'detect' };
  if (parts[0] === 'learn') return { name: 'learn', param: parts[1] ? decodeURIComponent(parts[1]) : undefined };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribeStore, getData);
}

export function usePrefs(): Prefs {
  useSyncExternalStore(subscribeStore, () => getPrefs().name + String(getPrefs().motionFx));
  return getPrefs();
}

/** Live clock for the HUD header. */
export function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return useCallback(() => now, [now])().toLocaleTimeString([], { hour12: false });
}
