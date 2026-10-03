// First-visit personalization as a 3D tilt card — pointer-tracked depth,
// the ask-name prompt floats on its own layer. Optional, local-only,
// explicitly NOT an account.
import { useState } from 'react';
import { setPrefs } from '../services/store';
import { Icon } from '../ui/icons';
import { Tilt3D, ScrambleButton } from '../ui/fx';

export function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const finish = (displayName: string | null) => {
    setPrefs({ name: displayName, welcomed: true });
    onDone();
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to VR KRYPTA">
      <Tilt3D className="welcome__scene" max={13}>
        <div className="welcome__card">
          <div className="welcome__logo" style={{ transform: 'translateZ(58px)' }}>
            <img src={`${import.meta.env.BASE_URL}icons/logo.png`} alt="" width="64" height="64" className="brandmark-img" />
          </div>
          <h1 className="welcome__title" style={{ transform: 'translateZ(42px)' }}>WELCOME TO<br />VR KRYPTA</h1>
          <p className="welcome__mantra" style={{ transform: 'translateZ(34px)' }}>TRANSFORM • DECIPHER • ANALYZE</p>
          <p className="welcome__q" style={{ transform: 'translateZ(46px)' }}>What should we call you?</p>
          <form
            style={{ transform: 'translateZ(30px)' }}
            onSubmit={(e) => {
              e.preventDefault();
              const clean = name.trim().slice(0, 40);
              if (clean.length > 40) { setError('Keep it under 40 characters.'); return; }
              finish(clean || null);
            }}
          >
            <input
              className="input input--welcome"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Enter your name"
              maxLength={40}
              autoFocus
              autoCapitalize="words"
              aria-label="Your display name"
            />
            {error && <p className="welcome__err">{error}</p>}
            <ScrambleButton type="submit" label="CONTINUE  →" className="btn--primary btn--lg welcome__go" />
          </form>
          <button type="button" className="welcome__guest" style={{ transform: 'translateZ(24px)' }} onClick={() => finish(null)}>
            Continue as Guest
          </button>
          <p className="welcome__fine" style={{ transform: 'translateZ(16px)' }}>
            Stored only in this browser as a display preference — no account, no email, no password,
            nothing uploaded. Change or clear it anytime in Settings.
          </p>
          <p className="welcome__brand" style={{ transform: 'translateZ(38px)' }}><Icon name="sparkle" size={11} /> VR DEVELOPMENTS <Icon name="sparkle" size={11} /></p>
        </div>
      </Tilt3D>
    </div>
  );
}
