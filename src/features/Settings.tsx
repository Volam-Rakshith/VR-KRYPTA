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


      <section className="panel">
        <h2 className="panel__title"><Icon name="link" size={15} /> VR DEVELOPMENTS — connect</h2>
        <ClipLinks />
        <p className="share__fine" style={{ textAlign: 'center' }}>LinkedIn loads soon — everything else is live.</p>
      </section>
    </div>
  );
}

/* ----------------------------- clip-path links ----------------------------- */

const NO_CLIP = 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)';
const CLIP_IN: Record<string, string[]> = {
  left: ['polygon(0 0, 100% 0, 0 0, 0% 100%)', NO_CLIP],
  right: ['polygon(0 0, 0 100%, 100% 100%, 0% 100%)', NO_CLIP],
  top: ['polygon(0 0, 100% 0, 100% 0, 0% 0)', NO_CLIP],
  bottom: ['polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)', NO_CLIP]
};
const CLIP_OUT: Record<string, string[]> = {
  left: [NO_CLIP, 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)'],
  right: [NO_CLIP, 'polygon(0 0, 0 0, 0 100%, 0 100%)'],
  top: [NO_CLIP, 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)'],
  bottom: [NO_CLIP, 'polygon(0 0, 100% 0, 100% 0%, 0% 0%)']
};

const BRAND_SVGS: Record<string, React.ReactNode> = {
  github: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M2.5 6.5l9.5 7 9.5-7" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3a8.5 8.5 0 0 0-7.3 12.7L3.4 20.6l5-1.3A8.5 8.5 0 1 0 12 3z" strokeLinejoin="round" />
      <circle cx="8.6" cy="11.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.6" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="11.6" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21.5 4.2L3.2 11.3c-.8.3-.8 1.3.1 1.6l4.1 1.3 1.6 4.9c.2.7 1 .9 1.5.4l2.2-2.1 4 2.9c.6.4 1.5.1 1.7-.6l3.6-14.5c.1-.8-.5-1.4-1.5-1z" strokeLinejoin="round" />
      <path d="M7.3 12.6l10.2-6.4-7.1 8.4" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  )
};

const CONNECT_LINKS = [
  { id: 'github', label: 'GitHub', handle: 'Volam-Rakshith', href: 'https://github.com/Volam-Rakshith', live: true },
  { id: 'mail', label: 'Email', handle: 'volamrakshith2008@gmail.com', href: 'mailto:volamrakshith2008@gmail.com', live: true },
  { id: 'phone', label: 'Phone', handle: '+91 79894 05979', href: 'tel:+917989405979', live: true },
  { id: 'whatsapp', label: 'WhatsApp', handle: '+91 79894 05979', href: 'https://wa.me/917989405979', live: true },
  { id: 'telegram', label: 'Telegram', handle: '@volamrakshith', href: 'https://t.me/volamrakshith', live: true },
  { id: 'instagram', label: 'Instagram', handle: '@rishi_kumar_lfy', href: 'https://instagram.com/rishi_kumar_lfy', live: true },
  { id: 'linkedin', label: 'LinkedIn', handle: 'Volam Rakshith', href: '#', live: false }
];

function ClipLinks() {
  const toast = useToast();

  const nearestSide = (e: React.MouseEvent): string => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const d = [
      { p: Math.abs(box.left - e.clientX), s: 'left' },
      { p: Math.abs(box.right - e.clientX), s: 'right' },
      { p: Math.abs(box.top - e.clientY), s: 'top' },
      { p: Math.abs(box.bottom - e.clientY), s: 'bottom' }
    ];
    return d.sort((a, b2) => a.p - b2.p)[0].s;
  };

  const wipe = (e: React.MouseEvent, dir: 'in' | 'out') => {
    const el = (e.currentTarget as HTMLElement).querySelector('.cliplink__face') as HTMLElement | null;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const side = nearestSide(e);
    const frames = (dir === 'in' ? CLIP_IN : CLIP_OUT)[side];
    el.animate([{ clipPath: frames[0] }, { clipPath: frames[1] }], { duration: 260, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)', fill: 'forwards' });
  };

  return (
    <div className="cliplinks" role="navigation" aria-label="VR DEVELOPMENTS socials">
      {CONNECT_LINKS.map((l) => (
        <a
          key={`${l.id}`}
          className="cliplink"
          href={l.live ? l.href : undefined}
          target={l.live ? '_blank' : undefined}
          rel={l.live ? 'noreferrer' : undefined}
          aria-label={l.live ? `${l.label} (opens in new tab)` : `${l.label} — coming soon`}
          onMouseEnter={(e) => wipe(e, 'in')}
          onMouseLeave={(e) => wipe(e, 'out')}
          onClick={(e) => { if (!l.live) { e.preventDefault(); toast(`${l.label} handle drops soon — link not wired yet`, 'info'); } }}
        >
          <span className="cliplink__icon">
            {BRAND_SVGS[l.id]}
            <span className="cliplink__label">{l.label}</span>
            <span className="cliplink__handle">{l.live ? l.handle : 'coming soon'}</span>
          </span>
          <span className="cliplink__face" aria-hidden="true" style={{ clipPath: 'polygon(0 0, 100% 0, 0 0, 0% 100%)' }}>
            <span className="cliplink__icon cliplink__icon--face">{BRAND_SVGS[l.id]}<span className="cliplink__label">{l.label}</span></span>
          </span>
        </a>
      ))}
    </div>
  );
}
