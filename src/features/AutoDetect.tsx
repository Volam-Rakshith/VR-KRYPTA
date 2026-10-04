// AUTO-DETECT — forensic identification of unknown data. Paste anything;
// KRYPTA profiles its structure, runs every signature battery, decodes to
// verify, and ranks the most likely systems with confidence scores.
import { useEffect, useRef, useState } from 'react';
import { analyze, profile } from '../services/detect';
import type { DetectHit, SignalProfile } from '../services/detect';
import { Icon } from '../ui/icons';
import { useToast, copyText } from '../ui/components';
import { navigate } from '../hooks/useApp';
import { inkEncode } from '../operations/invisibleInk';
import { emojiEncode } from '../operations/emojiSkin';
import '../operations';

const FAMILY_META: Record<DetectHit['family'], { label: string; cls: string }> = {
  encoding: { label: 'ENCODING', cls: 'det-fam--enc' },
  code: { label: 'CODE', cls: 'det-fam--code' },
  cipher: { label: 'CIPHER', cls: 'det-fam--cipher' },
  hash: { label: 'HASH · ONE-WAY', cls: 'det-fam--hash' },
  format: { label: 'FORMAT', cls: 'det-fam--format' },
  secret: { label: 'SECRET', cls: 'det-fam--secret' },
  unknown: { label: 'UNKNOWN', cls: 'det-fam--unknown' }
};

const SAMPLES: { label: string; make: () => string }[] = [
  { label: '🔍 hex', make: () => Array.from('meet me at the clock tower', (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ') },
  { label: '📮 base64', make: () => btoa('the shipment arrives saturday') },
  { label: '📡 morse', make: () => '- .... . / -- --- --- -.. / -.. --- -- -.. / .- .-. .-. .. ...- . ... / .-- . -.. -. . ... -.. .- -.--' },
  { label: '🔤 caesar', make: () => 'yfn clo il jdpw, ybmz hyl lq yfx clozu' },
  { label: '🔢 a1z26', make: () => '13 5 5 20 / 9 14 / 20 8 5 / 1 12 12 5 25' },
  { label: '😺 emoji skin', make: () => emojiEncode('the vault opens friday', 'animals') },
  { label: '🕶 zero-width', make: () => inkEncode('just checking in lol', 'backup codes: 482-991-5207') },
  { label: '🔑 vigenère-ish', make: () => 'LIVVSCLRFQATZRGJRDELAVQQWGWRPKVUTCZPPFLRWBQGLBLOFXXUTXZQYETVGCKGTVZXJMLSJIEKTMFLJZWKNUSAWDZPPOIQMQBLSDRVZRQHZL' }
];

export function AutoDetect() {
  const [input, setInput] = useState('');
  const [hits, setHits] = useState<DetectHit[]>([]);
  const [prof, setProf] = useState<SignalProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [output, setOutput] = useState<{ label: string; text: string } | null>(null);
  const toast = useToast();
  const timer = useRef<number | null>(null);

  const scan = (text: string) => {
    const src = text.trim();
    if (!src) { setHits([]); setProf(null); setScanned(false); return; }
    setBusy(true);
    setProf(profile(src));
    setScanned(true);
    void analyze(src).then((h) => { setHits(h); setBusy(false); });
  };

  // auto-scan while typing (debounced)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => scan(input), 400);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const copy = async (text: string, label: string) => {
    if (await copyText(text)) toast(label + ' copied', 'ok');
    else toast('Copy failed — select manually', 'err');
  };

  return (
    <div className="det page">
      <header className="det-head">
        <h1 className="page-title"><Icon name="magnifier" size={22} /> AUTO-DETECT</h1>
        <p className="page-sub">
          Paste mystery data. KRYPTA reads its fingerprints — structure, charset, length, padding, entropy, statistics —
          decodes to verify, and ranks what it most likely is. Nothing leaves your device.
        </p>
      </header>

      <section className="det-panel">
        <label className="det-label" htmlFor="det-in">unknown data</label>
        <textarea
          id="det-in"
          className="det-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste hex, glyphs, dots and dashes, a blob of numbers, a suspicious string… analysis starts as you type."
          rows={6}
          spellCheck={false}
        />
        <div className="det-samples">
          <span className="det-samples__label">or load a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.label} type="button" className="det-chip" onClick={() => setInput(s.make())}>{s.label}</button>
          ))}
        </div>

        {prof && (
          <div className="det-profile" aria-label="Signal profile">
            <span><b>{prof.chars.toLocaleString()}</b> chars</span>
            <span><b>{prof.bytes.toLocaleString()}</b> bytes</span>
            <span><b>{prof.distinct}</b> distinct</span>
            <span><b>{prof.entropy.toFixed(2)}</b> bits/char</span>
            <span><b>{Math.round(prof.printableRatio * 100)}%</b> printable</span>
            <span><b>{Math.round(prof.letterRatio * 100)}%</b> letters</span>
          </div>
        )}
      </section>

      {busy && <p className="det-scanning"><span className="det-scanning__dot" /> scanning signatures…</p>}

      {scanned && !busy && hits.length > 0 && (
        <section className="det-results" aria-live="polite">
          <h2 className="det-results__title">ranked possibilities</h2>
          {hits.map((h, i) => (
            <article key={h.id + String(i)} className={`det-hit ${i === 0 ? 'det-hit--top' : ''}`}>
              <div className="det-hit__rank" aria-hidden>{i + 1}</div>
              <div className="det-hit__body">
                <div className="det-hit__head">
                  <span className={`det-fam ${FAMILY_META[h.family].cls}`}>{FAMILY_META[h.family].label}</span>
                  <h3 className="det-hit__label">{h.label}</h3>
                </div>
                <div className="det-hit__meter">
                  <div className="det-meter" role="progressbar" aria-valuenow={Math.round(h.confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${h.confidence * 100}%` }} className={h.confidence > 0.8 ? 'det-meter--sure' : h.confidence > 0.55 ? 'det-meter--likely' : 'det-meter--maybe'} />
                  </div>
                  <span className="det-hit__pct">{Math.round(h.confidence * 100)}%</span>
                  <span className="det-hit__conf-word">{h.confidence > 0.8 ? 'signature-verified' : h.confidence > 0.55 ? 'decode-verified' : 'statistical hint'}</span>
                </div>
                <p className="det-hit__reason">{h.reason}</p>
                {h.note && <p className="det-hit__note"><Icon name="info" size={11} /> {h.note}</p>}

                {h.decoded !== undefined && (
                  <div className="det-hit__preview">
                    <span className="det-hit__preview-tag">DECODED PREVIEW</span>
                    <code>{h.decoded.slice(0, 220) || '(empty output)'}{h.decoded.length > 220 ? '…' : ''}</code>
                  </div>
                )}

                <div className="det-hit__actions">
                  {h.decoded !== undefined && (
                    <button type="button" className="btn btn--sm" onClick={() => setOutput({ label: h.label, text: h.decoded! })}>
                      <Icon name="play" size={12} /> FULL DECODE
                    </button>
                  )}
                  {h.decoded !== undefined && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(h.decoded!, h.label)}>
                      <Icon name="copy" size={12} /> COPY
                    </button>
                  )}
                  {h.decoded !== undefined && h.decoded.trim().length > 0 && (
                    <button type="button" className="btn btn--ghost btn--sm" title="Re-run detection on the decoded output" onClick={() => { setInput(h.decoded!); setOutput(null); }}>
                      <Icon name="swap" size={12} /> CHAIN →
                    </button>
                  )}
                  {h.opId && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/op/' + h.opId)}>
                      <Icon name="arrowRight" size={12} /> OPEN IN STUDIO
                    </button>
                  )}
                  {h.needsKey && (
                    <button type="button" className="btn btn--sm" onClick={() => navigate('/share')}>
                      <Icon name="link" size={12} /> UNLOCK IN SECRET DROP
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {output && (
        <section className="det-output">
          <div className="det-output__head">
            <h2 className="det-output__title"><Icon name="check" size={14} /> decoded with: {output.label}</h2>
            <div className="det-output__btns">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(output.text, 'Output')}>
                <Icon name="copy" size={12} /> COPY
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOutput(null)}>
                <Icon name="x" size={12} /> CLOSE
              </button>
            </div>
          </div>
          <pre className="det-output__text">{output.text}</pre>
        </section>
      )}
    </div>
  );
}
