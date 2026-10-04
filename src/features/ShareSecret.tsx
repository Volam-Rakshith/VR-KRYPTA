// SECRET DROP — share-locked secrets with friends.
// Create mode: type a secret + passphrase → VK1 blob + share link.
// Reveal mode (#/share/VK1...): branded landing that shows the sealed blob,
// a copy button, and a passphrase prompt to reveal the message in place.
import { useMemo, useState, useEffect } from 'react';
import { lockerEncrypt, lockerEncryptTimelock, lockerDecrypt, calibrateRounds, isTimelocked } from '../operations/locker';
import { inkEncode, inkDecode, hasInk } from '../operations/invisibleInk';
import { getOp } from '../operations';
import { Icon } from '../ui/icons';
import { TiltLogo, ScrambleButton, spawnRipple } from '../ui/fx';
import { useToast } from '../ui/components';
import { navigate } from '../hooks/useApp';
import { parseCaptured, capturedInvite } from '../services/share';
import { maskText, cinematicFrames, blip } from '../services/cinema';
import { styleAt, randomStyleIndex, withStyleMarker, withBurnMarker, splitStyleMarker, splitBurnMarker, styleTokens, STYLE_COUNT, BURN_FUSES } from './shareThemes';
import { Select } from '../ui/select';

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
  const [styleIdx, setStyleIdx] = useState(() => randomStyleIndex());
  const [cover, setCover] = useState("can't talk rn, busy with school 😅");
  const [timelock, setTimelock] = useState(false);
  const [tlSeconds, setTlSeconds] = useState(15);
  const [burn, setBurn] = useState(false);
  const [burnFuse, setBurnFuse] = useState(15);
  const [grind, setGrind] = useState<number | null>(null);
  const style = styleAt(styleIdx);

  const link = useMemo(() => {
    if (!blob) return null;
    let frag = withStyleMarker(blob, styleIdx);
    if (burn) frag = withBurnMarker(frag, burnFuse);
    return shareUrl(frag);
  }, [blob, styleIdx, burn, burnFuse]);

  const strength = pass.length === 0 ? '' : pass.length < 6 ? 'too short' : pass.length < 10 ? 'okay' : pass.length < 16 ? 'good' : 'fortress';

  const forge = async () => {
    if (!message.trim()) { toast('Type the secret first', 'err'); return; }
    if (pass.length < 6) { toast('Passphrase needs 6+ characters', 'err'); return; }
    setBusy(true);
    try {
      if (timelock) {
        setGrind(0);
        const rounds = await calibrateRounds(tlSeconds);
        setBlob(await lockerEncryptTimelock(message.trim(), pass, rounds, setGrind));
      } else {
        setBlob(await lockerEncrypt(message.trim(), pass));
      }
      toast('Secret sealed — share the link', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sealing failed', 'err');
    } finally {
      setBusy(false);
      setGrind(null);
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
        {/* SECRET DROP 2.0 — the reveal page wears the style you forge here. */}
        <div className="timelock">
          <button type="button" className={`tl-toggle ${timelock ? 'tl-toggle--on' : ''}`} onClick={() => setTimelock(!timelock)} aria-pressed={timelock}>
            <Icon name="clock" size={13} /> ⏳ TIMELOCK DROP <span className="tl-toggle__pill">{timelock ? 'ON' : 'OFF'}</span>
          </button>
          {timelock && (
            <div className="tl-body">
              <Select
                className="tl-select"
                value={String(tlSeconds)}
                onChange={(v) => setTlSeconds(Number(v))}
                ariaLabel="Grind duration"
                options={[
                  { value: '10', label: '~10 seconds of grind' },
                  { value: '30', label: '~30 seconds of grind' },
                  { value: '60', label: '~1 minute of grind' },
                  { value: '120', label: '~2 minutes of grind' }
                ]}
              />
              {grind !== null && (
                <div className="tl-bar" role="progressbar" aria-valuenow={Math.round(grind * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${grind * 100}%` }} />
                </div>
              )}
              <p className="share__fine">Honest mechanics: the secret's key is stretched through a hash-chain grind. YOUR device grinds once now, THEIRS grinds once on open — each side waits once. Friction as theater; the AES lock is the real wall.</p>
            </div>
          )}
        </div>
        <div className="timelock">
          <button type="button" className={`burn-toggle ${burn ? 'burn-toggle--on' : ''}`} onClick={() => setBurn(!burn)} aria-pressed={burn}>
            <Icon name="bolt" size={13} /> 🔥 BURN AFTER READING <span className="tl-toggle__pill">{burn ? 'ON' : 'OFF'}</span>
          </button>
          {burn && (
            <div className="tl-body burn-body">
              <Select
                className="tl-select"
                value={String(burnFuse)}
                onChange={(v) => setBurnFuse(Number(v))}
                ariaLabel="Burn fuse"
                options={BURN_FUSES.map((f) => ({ value: String(f), label: f < 60 ? `burns ${f}s after reveal` : 'burns 1 minute after reveal' }))}
              />
              <p className="share__fine">Theater, not magic: once the recipient reveals the message, a count-down runs and the screen burns to ash — then the lock re-arms. Screenshots beat drama; the fuse burns this screen, never the link. Anybody with the passphrase can relight it.</p>
            </div>
          )}
        </div>
        <label className="share__label">reveal style <span className="share__strength">{STYLE_COUNT} looks</span></label>
        <div className="sdstyle">
          <div className={`sdstyle__preview ${style.pattern.cls}`} style={styleTokens(style)} aria-hidden="true">
            <span className={`sdstyle__title ${style.motif.cls}`}>SEALED FOR YOU</span>
            <span className="sdstyle__sub">VR — KRYPTA · by VR DEVELOPMENTS</span>
          </div>
          <div className="sdstyle__picker">
            <Select
              className="sdstyle__select"
              value={String(styleIdx)}
              onChange={(v) => setStyleIdx(Number(v))}
              ariaLabel="Reveal style"
              maxHeight={260}
              options={Array.from({ length: STYLE_COUNT }, (_, i) => ({ value: String(i), label: styleAt(i).name }))}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm sdstyle__shuffle"
              title="Shuffle the style"
              onClick={() => setStyleIdx((i) => randomStyleIndex(i))}
            >
              <Icon name="sparkle" size={13} /> SHUFFLE
            </button>
          </div>
        </div>
        <ScrambleButton
          label={busy ? (grind !== null ? `GRINDING… ${Math.round(grind * 100)}%` : 'SEALING…') : 'SEAL THE SECRET'}
          icon="bolt"
          className="btn--primary btn--lg share__forge"
          disabled={busy}
          onClick={() => void forge()}
        />
        <p className="share__fine">AES-256-GCM + PBKDF2 × 200,000 · sealed locally in your browser · nothing is uploaded anywhere.</p>
      </section>

      <GhostDetector />

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
          <p className="share__fine">Send the link or blob over anything. Send the <strong>passphrase separately</strong> — that separation is the whole point.</p>
          <div className="ghostwrap">
            <p className="share__label"><span className="ghostwrap__tag">NEW</span> ghost mode — invisible ink</p>
            <input
              className="input share__pass"
              type="text"
              value={cover}
              maxLength={160}
              onChange={(e) => setCover(e.target.value)}
              aria-label="Innocent cover text"
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm ghostwrap__btn"
              onClick={() => void copyText(inkEncode(cover.trim(), blob), 'Ghost message copied — it LOOKS like plain text', toast)}
            >
              <Icon name="fingerprint" size={13} /> Copy ghost message
            </button>
            <p className="share__fine">Your blob hides invisibly after that sentence. The recipient pastes it into the <strong>ghost detector</strong> below (or the Invisible Ink op) to pull it out. Test it first — some platforms strip invisible characters.</p>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ GHOST DETECTOR ----------------------------- */

/** Paste any suspicious text — invisible ink surfaces instantly; VK1 blobs jump to reveal. */
function GhostDetector() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [found, setFound] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const scan = () => {
    setDirty(true);
    if (!hasInk(text)) { setFound(null); toast('No invisible ink in that text', 'info'); return; }
    const out = inkDecode(text);
    if (out === null) { setFound(null); toast('Invisible characters present but payload is broken — platform likely stripped it', 'err'); return; }
    const m = out.match(/VK1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (m) { navigate(`/share/${m[0]}`); return; }
    setFound(out);
  };

  return (
    <section className="share__card ghostdet">
      <p className="share__label"><span className="ghostwrap__tag">NEW</span> 👻 ghost detector</p>
      <p className="share__fine" style={{ margin: '0 0 10px' }}>Got a message that feels… oddly spaced? Paste it here. Invisible secrets surface instantly; sealed VK1 blobs jump straight to the reveal page.</p>
      <textarea
        className="io-area share__msg"
        rows={3}
        placeholder="paste the suspicious text…"
        value={text}
        onChange={(e) => { setText(e.target.value); setFound(null); setDirty(false); }}
      />
      <div className="share__row">
        <button type="button" className="btn btn--violet btn--sm" onClick={scan}>
          <Icon name="fingerprint" size={13} /> SCAN FOR INK
        </button>
      </div>
      {found && (
        <div className="share__secret" style={{ marginTop: 12 }}>
          {found}
          <div className="share__row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(found, 'Extracted secret copied', toast)}>
              <Icon name="copy" size={13} /> Copy
            </button>
          </div>
        </div>
      )}
      {dirty && !found && <p className="share__err">✓ clean — no invisible ink detected.</p>}
    </section>
  );
}

/* ------------------------------- REVEAL MODE ------------------------------- */

type CinPhase = 'idle' | 'scan' | 'crawl' | 'done';

function RevealView({ payload }: { payload: string }) {
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const { rest, fuse } = splitBurnMarker(payload);
  const { clean, style } = splitStyleMarker(rest);
  const tokens = styleTokens(style ?? styleAt(0));
  const [cin, setCin] = useState<CinPhase>('idle');
  const [shown, setShown] = useState(0);
  const [grindPct, setGrindPct] = useState<number | null>(null);
  const [burnPhase, setBurnPhase] = useState<'idle' | 'count' | 'burn' | 'ash'>('idle');
  const [fuseLeft, setFuseLeft] = useState<number>(fuse ?? 0);
  const timelocked = isTimelocked(clean);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cinematic crawl: cipher noise resolves character-by-character with synth ticks
  useEffect(() => {
    if (!secret || cin !== 'crawl' || reduced) return;
    void blip(1180, 40, 0.05);
    const { frames, perFrame } = cinematicFrames(secret);
    let f = 0;
    const iv = setInterval(() => {
      f++;
      setShown((s2) => s2 + perFrame);
      if (f % 5 === 0) void blip(940, 24, 0.03);
      if (f >= frames) {
        clearInterval(iv);
        setShown(secret.length);
        setCin('done');
        void blip(660, 60, 0.06);
        setTimeout(() => void blip(1320, 50, 0.05), 90);
        setTimeout(() => void blip(1760, 70, 0.04), 190);
      }
    }, 26);
    return () => clearInterval(iv);
  }, [cin, secret, reduced]);

  // burn-after-reading fuse: starts the second the message is fully visible
  useEffect(() => {
    if (secret === null || fuse === null || burnPhase === 'ash' || burnPhase === 'burn') return;
    if (cin !== 'done') return;
    setBurnPhase('count');
    let left = fuse;
    setFuseLeft(left);
    const iv = setInterval(() => {
      left -= 1;
      setFuseLeft(left);
      if (left <= 5 && left > 0) void blip(300 + (5 - left) * 120, 60, 0.06);
      if (left <= 0) {
        clearInterval(iv);
        setBurnPhase('burn');
        void blip(140, 500, 0.09);
        setTimeout(() => {
          setSecret(null);
          setCin('idle');
          setShown(0);
          setPass('');
          setBurnPhase('ash');
        }, 1900);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [secret, fuse, cin, burnPhase]);

  const reveal = async () => {
    if (!pass) { setErr('Enter the passphrase the sender gave you.'); return; }
    setBusy(true);
    setErr('');
    try {
      const msg = await lockerDecrypt(clean, pass, isTimelocked(clean) ? setGrindPct : undefined);
      setBurnPhase('idle');
      setSecret(msg);
      if (reduced) { void blip(880, 50, 0.05); setCin('done'); setShown(msg.length); }
      else {
        setCin('scan');
        void blip(520, 60, 0.05);
        setTimeout(() => setCin('crawl'), 850);
      }
      // little celebration: ripple burst in the card colors
      const cols = style ? [style.palette.c1, style.palette.c2, style.palette.c3] : ['#22d3ee', '#8b5cf6', '#3b82f6'];
      for (let i = 0; i < 9; i++) {
        setTimeout(() => {
          spawnRipple(
            window.innerWidth * (0.3 + Math.random() * 0.4),
            window.innerHeight * (0.3 + Math.random() * 0.4),
            cols[i % cols.length]
          );
        }, i * 90);
      }
    } catch {
      setErr('That passphrase doesn\'t open it — grind spent, result lost. Check it with the sender.');
    } finally {
      setBusy(false);
      setGrindPct(null);
    }
  };

  return (
    <div className={`share page page--narrow share--styled ${style?.pattern.cls ? `has-pattern ${style.pattern.cls}` : ''}`} style={tokens}>
      <header className="share__head">
        <TiltLogo size={96} />
        <p className="share__eyebrow">VR — KRYPTA · BY VR DEVELOPMENTS</p>
        <h1 className={`neon-title ${style?.motif.cls ?? "mot-solid"}`}>SEALED FOR YOU</h1>
        <p className="share__sub">Someone sent you a locked message. Only the passphrase opens it.</p>
        {style && <span className="share__stylechip">{style.name}</span>}
      </header>

      {!secret && burnPhase === 'ash' && (
        <div className="burn-ash" role="status">
          <Icon name="x" size={13} /> 🔥 ashes. The screen burned on schedule — the lock re-armed. Enter the passphrase to relight it.
        </div>
      )}
      {!secret && (
        <section className="share__card share__card--glowborder">
          <p className="share__label">sealed code</p>
          <div className="share__blob">{clean}</div>
          <div className="share__row">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyText(clean, 'Sealed code copied', toast)}>
              <Icon name="copy" size={13} /> Copy code
            </button>
          </div>
          {timelocked && <p className="tl-note"><Icon name="clock" size={12} /> TIMELOCKED DROP — this device must grind once to open it ({clean.match(/VK1\.T\.[0-9a-f]{32}\.(\d+)/)?.[1] ?? '∞'} rounds). So will yours if you're lying about the passphrase. 😈</p>}
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
          {grindPct !== null && (
            <div className="tl-grind">
              <div className="tl-bar" role="progressbar" aria-valuenow={Math.round(grindPct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${grindPct * 100}%` }} />
              </div>
              <span className="tl-grind__pct">GRINDING {Math.round(grindPct * 100)}% — your device is doing the wait</span>
            </div>
          )}
          {err && <p className="share__err">{err}</p>}
          <p className="share__fine">Decryption happens locally in this browser (AES-256-GCM). The passphrase never leaves the device.</p>
        </section>
      )}

      {secret !== null && (
        <section className="share__card share__card--revealed">
          <p className="share__label">the secret</p>
          {fuse !== null && burnPhase === 'count' && (
            <div className="burn-chip" role="timer" aria-live="polite">
              <Icon name="bolt" size={12} /> 🔥 burns in <strong>{fuseLeft}s</strong>
              <span className="burn-note">screenshots beat drama — this fuse burns the screen, not the link</span>
            </div>
          )}
          {cin !== 'done' && <div className="cin-scan" aria-hidden="true" />}
          {burnPhase === 'burn' && <div className="burn-fire" aria-hidden="true" />}
          <div
            className={`share__secret ${cin !== 'done' ? 'share__secret--cin' : ''} ${burnPhase === 'burn' ? 'share__secret--burning' : ''}`}
            onClick={() => { if (cin !== 'done') { setShown(secret.length); setCin('done'); } }}
            title={cin !== 'done' ? 'tap to finish instantly' : undefined}
            role={cin !== 'done' ? 'button' : undefined}
          >
            {cin === 'done' ? secret : maskText(secret, shown)}
          </div>
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
