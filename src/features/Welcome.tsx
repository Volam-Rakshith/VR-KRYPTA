// First-visit personalization. Optional, local-only, explicitly NOT an account.
import { useState } from 'react';
import { setPrefs } from '../services/store';
import { Icon, BrandMark } from '../ui/icons';

export function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const finish = (displayName: string | null) => {
    setPrefs({ name: displayName, welcomed: true });
    onDone();
  };

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to VR KRYPTA">
      <div className="welcome__card">
        <BrandMark size={64} />
        <h1 className="welcome__title">WELCOME TO<br />VR KRYPTA</h1>
        <p className="welcome__mantra">TRANSFORM • DECIPHER • ANALYZE</p>
        <p className="welcome__q">What should we call you?</p>
        <form
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
          <button type="submit" className="btn btn--primary btn--lg welcome__go">
            CONTINUE <Icon name="arrowRight" size={15} />
          </button>
        </form>
        <button type="button" className="welcome__guest" onClick={() => finish(null)}>
          Continue as Guest
        </button>
        <p className="welcome__fine">
          Stored only in this browser as a display preference — no account, no email, no password,
          nothing uploaded. Change or clear it anytime in Settings.
        </p>
        <p className="welcome__brand">VR DEVELOPMENTS</p>
      </div>
    </div>
  );
}
