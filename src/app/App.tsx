import { useEffect, useState } from 'react';
import '../operations'; // registers the whole library
import { useRoute, navigate, usePrefs, useClock } from '../hooks/useApp';
import { getPrefs, initStore, setPrefs } from '../services/store';
import { opCount } from '../operations';
import { ToastProvider } from '../ui/components';
import { CursorFX, BackgroundFX, BootScreen } from '../ui/fx';
import { Icon, BrandMark } from '../ui/icons';
import { Dashboard } from '../features/Dashboard';
import { Explorer } from '../features/Explorer';
import { Workspace } from '../features/Workspace';
import { Pipelines } from '../features/Pipelines';
import { Settings, About } from '../features/Settings';
import { Welcome } from '../features/Welcome';

const NAV = [
  { path: '/', label: 'HOME', icon: 'home' },
  { path: '/explore', label: 'LIBRARY', icon: 'grid' },
  { path: '/pipelines', label: 'PIPELINES', icon: 'layers' },
  { path: '/settings', label: 'SETTINGS', icon: 'gear' }
];

function Header({ routeName }: { routeName: string }) {
  const prefs = usePrefs();
  const clock = useClock();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={() => navigate('/')} aria-label="VR KRYPTA home">
        <BrandMark size={30} />
        <span className="brand__word">VR KRYPTA</span>
      </button>
      <nav className={`nav ${menuOpen ? 'nav--open' : ''}`} aria-label="Main">
        {NAV.map((n) => (
          <button
            key={n.path}
            type="button"
            className={`nav__link ${(n.path === '/' ? routeName === 'home' : n.path.slice(1) === routeName) ? 'nav__link--on' : ''}`}
            onClick={() => { navigate(n.path); setMenuOpen(false); }}
          >
            <Icon name={n.icon} size={14} /> {n.label}
          </button>
        ))}
        <button
          type="button"
          className={`nav__link ${routeName === 'about' ? 'nav__link--on' : ''}`}
          onClick={() => { navigate('/about'); setMenuOpen(false); }}
        >
          <Icon name="info" size={14} /> ABOUT
        </button>
      </nav>
      <div className="app-header__hud">
        <span className="hud-clock" aria-label="Local time">{clock}</span>
        {prefs.name && <span className="hud-user"><Icon name="sparkle" size={12} /> {prefs.name.toUpperCase()}</span>}
        <button type="button" className="nav-burger" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__row">
        <span className="app-footer__brand">VR KRYPTA</span>
        <span className="app-footer__tag">The Universal Information Transformation Toolkit</span>
      </div>
      <div className="app-footer__row">
        <span><Icon name="shield" size={11} /> Local-first · No accounts · No telemetry</span>
        <span className="app-footer__by">A <strong>VR DEVELOPMENTS</strong> project · {opCount()} operations</span>
      </div>
    </footer>
  );
}

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    void initStore().then(() => setReady(true));
  }, []);

  if (!ready) return null; // pre-boot placeholder in index.html covers this paint

  const prefs = getPrefs();
  const showBoot = !booted && !prefs.bootSeen;
  const showWelcome = !showBoot && !prefs.welcomed;

  return (
    <ToastProvider>
      <BackgroundFX />
      <CursorFX />
      <div className="app" aria-hidden={showBoot || showWelcome}>
        <Header routeName={route.name} />
        <main className="app-main">
          {route.name === 'home' && <Dashboard key={prefs.name ?? 'guest'} />}
          {route.name === 'explore' && <Explorer initialCategory={route.param} />}
          {route.name === 'op' && <Workspace opId={route.param ?? ''} />}
          {route.name === 'pipelines' && <Pipelines />}
          {route.name === 'settings' && <Settings />}
          {route.name === 'about' && <About />}
        </main>
        <Footer />
      </div>
      {showBoot && (
        <BootScreen onDone={() => { setPrefs({ bootSeen: true }); setBooted(true); }} />
      )}
      {showWelcome && <Welcome onDone={() => setPrefs({ welcomed: true })} />}
    </ToastProvider>
  );
}
