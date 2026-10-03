// SECRET DROP — share-locked secrets with friends.
// Create mode: type a secret + passphrase → VK1 blob + share link + QR.
// Reveal mode (#/share/VK1...): branded landing that shows the sealed blob,
// a copy button, and a passphrase prompt to reveal the message in place.
import { useMemo, useState } from 'react';
import { lockerEncrypt, lockerDecrypt, renderQR } from '../operations/qr';
import { getOp } from '../operations';
import { Icon } from '../ui/icons';
import { TiltLogo, ScrambleButton } from '../ui/fx';
import { useToast } from '../ui/components';
import { navigate } from '../hooks/useApp';
import { parseCaptured, capturedInvite } from '../services/share';

type ToastFn = ReturnType<typeof useToast>;

function shareUrl(blob: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/share/${blob}`;
}

const SHARE_TEXT = (link: string) =>
  `🔐 I've sealed a secret for you.\n\n${link}\n\nOpen it and enter the passphrase I'll send you separately.\n— sealed with VR KRYPTA by VR DEVELOPMENTS`;

async function copyText(t: string, okMsg: string, toast: ToastFn) {
  try {
    await navigator.clipboard.writeText(t);
    toast(okMsg, 'ok');
  } catch {
    toast('Clipboard blocked by browser — select and copy manually', 'err');
  }
}

export function ShareSecret({ payload }: { payload?: string }) {
  if (!payload) return <CreateView />;
  if (payload.startsWith('x/')) return <ShareOutView fragment={payload} />;
  return <RevealView payload={payload} />;
}

/* ---------------------------- SHARED RESULT VIEW ---------------------------- */

function ShareOutView({ fragment }: { fragment: string }) {
  const toast = useToast();
  const data = useMemo(() => parseCaptured(fragment), [fragment]);
  const op = data ? getOp(data.opId) : undefined;
  const opName = op?.name ?? 'a VR KRYPTA operation';
  const link = `${location.origin}${import.meta.env.BASE_URL}#${location.hash === '' ? `/share/${fragment}` : location.hash.replace(/^#/, '')}`;
  const qrUp = useMemo(() => {
    try { return renderQR(link, 'M', true); } catch { return null; }
  }, [link]);
  const canNativeShare = typeof navigator.share === 'function';

  if (!data) {
    return (
      <div className="share page page--narrow">
        <header className="share__head">
          <TiltLogo size={96} />
          <p className="share__eyebrow">VR — KRYPTA · BY VR DEVELOPMENTS</p>
          <h1 className="neon-title">BROKEN LINK</h1>
          <p className="share__sub">This share link is corrupted or too long. Ask the sender to re-share.</p>
        </header>
        <p className="share__cta">
          <button type="button" className="share__ctalink" onClick={() => navigate('/')}>Open VR KRYPTA</button>
        </p>
      </div>
    );
  }

  const transformHere = () => {
    if (op) {
      sessionStorage.setItem(`vrk:prefill:${op.id}`, data.text);
      navigate(`/op/${op.id}`);
    } else {
      navigate('/explore');
    }
  };

  return (
    <div className="share page page--narrow">
      <header className="share__head">
        <TiltLogo size={96} />
        <p className="share__eyebrow">VR — KRYPTA · BY VR DEVELOPMENTS</p>
        <h1 className="neon-title">CODE FOR YOU</h1>
        <p className="share__sub">This was produced with <strong>{opName}</strong> on VR KRYPTA. See something hidden in it?</p>
      </header>

      <section className="share__card share__card--glowborder">
        <p className="share__label">the code</p>
        <div className="share__blob share__blob--code">{data.text}</div>
        <div className="share__row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(data.text, 'Code copied', toast)}>
            <Icon name="copy" size={13} /> Copy code
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(link, 'Link copied', toast)}>
            <Icon name="link" size={13} /> Copy link
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(capturedInvite(opName, link), 'Invite copied — paste it anywhere', toast)}>
            <Icon name="type" size={13} /> Copy invite
          </button>
          {canNativeShare && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void navigator.share({ title: `VR KRYPTA — ${opName}`, text: capturedInvite(opName, link) }).catch(() => undefined)}
            >
              <Icon name="signal" size={13} /> Share…
            </button>
          )}
        </div>

        <div className="share__row" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={transformHere}>
            <Icon name="bolt" size={16} /> TRANSFORM IT HERE →
          </button>
        </div>

        {qrUp && (
          <>
            <p className="share__label">scan to open</p>
            <div className="share__qrframe"><pre className="share__qr">{qrUp}</pre></div>
          </>
        )}
        <p className="share__fine">The link carries everything needed — nothing is stored server-side. Transform it in the full toolkit: <button type="button" className="share__ctalink" onClick={() => navigate('/')}>VR KRYPTA</button>.</p>
      </section>
    </div>
  );
}

/* ------------------------------- CREATE MODE ------------------------------- */

function CreateView() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<string | null>(null);

  const link = useMemo(() => (blob ? shareUrl(blob) : null), [blob]);
  const qr = useMemo(() => {
    if (!link) return null;
    try { return renderQR(link, 'M', true); } catch { return null; }
  }, [link]);

  const strength = pass.length === 0 ? '' : pass.length < 6 ? 'too short' : pass.length < 10 ? 'okay' : pass.length < 16 ? 'good' : 'fortress';

  const forge = async () => {
    if (!message.trim()) { toast('Type the secret first', 'err'); return; }
    if (pass.length < 6) { toast('Passphrase needs 6+ characters', 'err'); return; }
    setBusy(true);
    try {
      setBlob(await lockerEncrypt(message.trim(), pass));
      toast('Secret sealed — share the link or QR', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sealing failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share page page--narrow">
      <header className="share__head">
        <TiltLogo size={96} />
        <p className="share__eyebrow">VR — KRYPTA · BY VR DEVELOPMENTS</p>
        <h1 className="neon-title">SECRET DROP</h1>
        <p className="share__sub">Seal a message. Share the link. Only the passphrase opens it.</p>
      </header>

      <section className="share__card">
        <label className="share__label" htmlFor="sd-msg">your secret</label>
        <textarea
          id="sd-msg"
          className="io-area share__msg"
          rows={4}
          maxLength={600}
          placeholder="the thing only they should read…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <label className="share__label" htmlFor="sd-pass">passphrase <span className="share__strength">{strength}</span></label>
        <input
          id="sd-pass"
          className="input share__pass"
          type="text"
          placeholder="shared with them over a different channel"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="off"
        />
        <ScrambleButton
          label={busy ? 'SEALING…' : 'SEAL THE SECRET'}
          icon="bolt"
          className="btn--primary btn--lg share__forge"
          disabled={busy}
          onClick={() => void forge()}
        />
        <p className="share__fine">AES-256-GCM + PBKDF2 × 200,000 · sealed locally in your browser · nothing is uploaded anywhere.</p>
      </section>

      {blob && link && (
        <section className="share__card share__result">
          <p className="share__label">sealed blob</p>
          <div className="share__blob">{blob}</div>
          <div className="share__row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(blob, 'Blob copied', toast)}>
              <Icon name="copy" size={13} /> Copy blob
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(link, 'Share link copied', toast)}>
              <Icon name="link" size={13} /> Copy link
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void copyText(SHARE_TEXT(link), 'Full invite copied — paste it anywhere', toast)}>
              <Icon name="bolt" size={13} /> Copy message + link
            </button>
          </div>
          {qr && (
            <>
              <p className="share__label">scan to open</p>
              <div className="share__qrframe"><pre className="share__qr">{qr}</pre></div>
            </>
          )}
          <p className="share__fine">Send the link or QR over anything. Send the <strong>passphrase separately</strong> — that separation is the whole point.</p>
        </section>
      )}
    </div>
  );
}

/* ------------------------------- REVEAL MODE ------------------------------- */

function RevealView({ payload }: { payload: string }) {
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const reveal = async () => {
    if (!pass) { setErr('Enter the passphrase the sender gave you.'); return; }
    setBusy(true);
    setErr('');
    try {
      setSecret(await lockerDecrypt(payload, pass));
    } catch {
      setErr('That passphrase doesn\'t open this — check it with the sender.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="share page page--narrow">
      <header className="share__head">
        <TiltLogo size={96} />
        <p className="share__eyebrow">VR — KRYPTA · BY VR DEVELOPMENTS</p>
        <h1 className="neon-title">SEALED FOR YOU</h1>
        <p className="share__sub">Someone sent you a locked message. Only the passphrase opens it.</p>
      </header>

      {!secret && (
        <section className="share__card share__card--glowborder">
          <p className="share__label">sealed code</p>
          <div className="share__blob">{payload}</div>
          <div className="share__row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(payload, 'Sealed code copied', toast)}>
              <Icon name="copy" size={13} /> Copy code
            </button>
          </div>
          <label className="share__label" htmlFor="rv-pass">reveal code here</label>
          <div className="share__revealrow">
            <input
              id="rv-pass"
              className="input share__pass"
              type="text"
              placeholder="passphrase from the sender"
              value={pass}
              autoComplete="off"
              autoFocus
              onChange={(e) => { setPass(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void reveal(); }}
            />
            <ScrambleButton
              label={busy ? 'OPENING…' : 'REVEAL'}
              icon="key"
              className="btn--primary btn--lg share__reveal"
              disabled={busy}
              onClick={() => void reveal()}
            />
          </div>
          {err && <p className="share__err">{err}</p>}
          <p className="share__fine">Decryption happens locally in this browser (AES-256-GCM). The passphrase never leaves the device.</p>
        </section>
      )}

      {secret !== null && (
        <section className="share__card share__card--revealed">
          <p className="share__label">the secret</p>
          <div className="share__secret">{secret}</div>
          <div className="share__row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(secret, 'Secret copied', toast)}>
              <Icon name="copy" size={13} /> Copy
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/share')}>
              <Icon name="bolt" size={13} /> Seal one back
            </button>
          </div>
        </section>
      )}

      <p className="share__cta">
        New here? Open the full toolkit:{' '}
        <button type="button" className="share__ctalink" onClick={() => navigate('/')}>
          VR KRYPTA — Universal Information Transformation Toolkit
        </button>
      </p>
    </div>
  );
}
