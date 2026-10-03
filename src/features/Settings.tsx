// Settings: display name (local preference — not an account), FX toggles,
// and data management. About: brand, scope, and honest privacy language.
import { useState } from 'react';
import { getPrefs, setPrefs, clearHistory, clearFavorites, clearAllData } from '../services/store';
import { useAppData, usePrefs, navigate } from '../hooks/useApp';
import { opCount, CATEGORIES, categoryCount } from '../operations';
import { clearPythonCacheHint } from '../services/python';
import { Icon, BrandMark } from '../ui/icons';
import { ConfirmModal, useToast } from '../ui/components';

export function Settings() {
  const prefs = usePrefs();
  const data = useAppData();
  const toast = useToast();
  const [name, setName] = useState(prefs.name ?? '');
  const [confirm, setConfirm] = useState<null | 'history' | 'favorites' | 'pipelines' | 'all'>(null);

  const saveName = () => {
    const clean = name.trim().slice(0, 40);
    setPrefs({ name: clean || null, welcomed: true });
    toast(clean ? `Personalization saved — hi, ${clean}.` : 'Name cleared — back to guest mode.', 'ok');
  };

  return (
    <div className="page page--narrow">
      <header className="page-head">
        <h1 className="page-title">SETTINGS</h1>
        <p className="page-sub">Everything on this page changes data stored only in this browser.</p>
      </header>

      <section className="panel">
        <h2 className="panel__title"><Icon name="sparkle" size={15} /> Personalization</h2>
        <p className="panel__text">
          Your display name is a local preference — <strong>not an account</strong>. There is no sign-up,
          no password, no identity check, and nothing is transmitted anywhere.
        </p>
        <div className="name-row">
          <input
            className="input input--mono"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={prefs.name ?? 'What should we call you?'}
            maxLength={40}
            aria-label="Display name"
          />
          <button type="button" className="btn btn--primary" onClick={saveName}>Save</button>
          {prefs.name && (
            <button type="button" className="btn btn--ghost" onClick={() => { setName(''); setPrefs({ name: null }); toast('Name cleared', 'ok'); }}>
              Clear
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title"><Icon name="bolt" size={15} /> Interface effects</h2>
        <label className="toggle toggle--row">
          <input type="checkbox" checked={prefs.motionFx} onChange={(e) => { setPrefs({ motionFx: e.target.checked }); toast(e.target.checked ? 'Ambient FX on (applies after reload)' : 'Ambient FX off (applies after reload)', 'info'); }} />
          <span className="toggle__track" />
          Ambient background particles &amp; custom cursor
        </label>
        <label className="toggle toggle--row">
          <input type="checkbox" checked={prefs.glowFx} onChange={(e) => setPrefs({ glowFx: e.target.checked })} />
          <span className="toggle__track" />
          Hover glow effects on cards and buttons
        </label>
        <p className="opt__help">System “reduce motion” settings are always respected and override these toggles.</p>
      </section>

      <section className="panel">
        <h2 className="panel__title"><Icon name="shield" size={15} /> Local data</h2>
        <p className="panel__text">
          {data.favorites.length} favorites · {data.history.length} history entries · {data.pipelines.length} saved pipelines —
          stored in IndexedDB/localStorage on this device only. Browser storage is not permanent and never synced:
          clearing site data, switching browsers or devices starts fresh.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm('history')} disabled={data.history.length === 0}>Clear history</button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm('favorites')} disabled={data.favorites.length === 0}>Clear favorites</button>
          <button type="button" className="btn btn--danger" onClick={() => setConfirm('all')}>
            <Icon name="trash" size={14} /> Erase ALL VR KRYPTA data
          </button>
        </div>
        <p className="opt__help">{clearPythonCacheHint()}</p>
      </section>

      <ConfirmModal
        open={confirm === 'history'} title="Clear transformation history?"
        body="All recorded runs will be removed from this browser. Favorites and pipelines are kept."
        confirmLabel="Clear history" danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await clearHistory(); setConfirm(null); toast('History cleared', 'ok'); }}
      />
      <ConfirmModal
        open={confirm === 'favorites'} title="Clear favorites?"
        body="Your starred operations will be unmarked. History and pipelines are kept."
        confirmLabel="Clear favorites" danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await clearFavorites(); setConfirm(null); toast('Favorites cleared', 'ok'); }}
      />
      <ConfirmModal
        open={confirm === 'all'} title="Erase everything?"
        body="This permanently removes your display name, preferences, favorites, history and saved pipelines from this browser, and resets the welcome screen. This cannot be undone."
        confirmLabel="Erase all data" danger
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await clearAllData(); setConfirm(null); toast('All VR KRYPTA data erased', 'ok'); navigate('/'); window.location.reload(); }}
      />
    </div>
  );
}

export function About() {
  return (
    <div className="page page--narrow">
      <header className="about-hero">
        <BrandMark size={72} />
        <h1 className="hero__title hero__title--sm">VR KRYPTA</h1>
        <p className="hero__mantra">THE UNIVERSAL INFORMATION TRANSFORMATION TOOLKIT<br />TRANSFORM • DECIPHER • ANALYZE</p>
        <p className="about-byline">A <strong>VR DEVELOPMENTS</strong> project</p>
      </header>

      <section className="panel">
        <h2 className="panel__title"><Icon name="info" size={15} /> What this is</h2>
        <p className="panel__text">
          VR KRYPTA is a local-first environment for discovering, applying and chaining information
          transformation systems: codes, classical ciphers, encodings, hashes, compression and byte-level
          operations — {opCount()} operations across {CATEGORIES.length} categories, each one genuinely
          implemented and verified against published test vectors. No placeholders, no “coming soon” buttons.
        </p>
        <div className="about-cats">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="about-cat">
              <Icon name={c.icon} size={15} />
              <strong>{c.name}</strong>
              <span>{categoryCount(c.id)} ops</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title"><Icon name="shield" size={15} /> Local-first processing</h2>
        <p className="panel__text">
          Your transformations run in your browser whenever supported. <strong>Your input is not automatically
          uploaded to any VR KRYPTA backend — the app has none.</strong> There are no accounts, no analytics,
          no telemetry, and transformation inputs, outputs and history are never transmitted to third parties.
        </p>
        <p className="panel__text">
          Two honest exceptions: (1) the app itself is downloaded from a static web host; (2) operations marked
          “python” fetch the Pyodide runtime (~10&nbsp;MB, one time, from a public CDN) and then execute it
          locally via WebAssembly — the service worker caches it for offline reuse.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title"><Icon name="key" size={15} /> Honest cryptography</h2>
        <p className="panel__text">
          Classical ciphers are historical study objects — all of them are breakable, and VR KRYPTA says so on
          every cipher page. MD5 and SHA-1 carry explicit collision warnings. Hashes are one-way: the app offers
          verification, never a fictional “hash decode”. VR KRYPTA is an exploration and education toolkit, not
          a password manager, and not a substitute for professional cryptographic review.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title"><Icon name="layers" size={15} /> Under the hood</h2>
        <p className="panel__text">
          React + TypeScript (strict) · Vite · Web Crypto API · Compression Streams API · Pyodide (CPython on
          WebAssembly) in a Web Worker · IndexedDB + localStorage · service-worker offline caching · static
          hosting on GitHub Pages.
        </p>
      </section>
    </div>
  );
}
