// Universal Transformation Workspace — one workspace renders every operation.
// Controls adapt to the operation contract (no Decode button on hashes, etc.)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getOp, CATEGORIES, relatedOps, defaultOptions } from '../operations';
import type { IOValue, OpContext, OperationDefinition } from '../operations/core/types';
import { hexToBytes, utf8 } from '../utils/bytes';
import { navigate, useAppData } from '../hooks/useApp';
import { addHistory, toggleFavorite } from '../services/store';
import { callPython, onPythonState, pythonState } from '../services/python';
import { Icon } from '../ui/icons';
import { Chip, CopyButton, EmptyState, downloadText, useToast } from '../ui/components';
import { OptionField } from '../ui/OptionsField';
import { SpringModal } from '../ui/modal';
import { ScrambleButton } from '../ui/fx';
import { capturedFragment, capturedInvite, SHARE_TEXT_LIMIT } from '../services/share';

import { stopAllMorse } from '../operations/morseAudio';

const ctx: OpContext = { python: (fn, args) => callPython<string>(fn, args) };

export function Workspace({ opId }: { opId: string }) {
  const op = getOp(opId);
  const toast = useToast();
  const data = useAppData();
  const [input, setInput] = useState('');
  const [inputHex, setInputHex] = useState(false);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [output, setOutput] = useState<IOValue | null>(null);
  const [outputHex, setOutputHex] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [pyState, setPyState] = useState(pythonState());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => onPythonState(setPyState), []);

  useEffect(() => {
    stopAllMorse(); // leaving/switching tools silences any running morse audio/light
    setOptions(op ? defaultOptions(op) : {});
    setOutput(null);
    setError(null);
    setInputHex(false);
    // Deep-link prefill: "Transform it here" from a shared result drops the
    // shared code straight into the input box of the right operation.
    const preKey = `vrk:prefill:${opId}`;
    const pre = sessionStorage.getItem(preKey);
    if (pre) {
      sessionStorage.removeItem(preKey);
      setInput(pre);
      toast('Shared code loaded — hit the transform action', 'ok');
    } else {
      setInput('');
    }
    inputRef.current?.focus();
  }, [opId, op]);

  const loadExample = useCallback(() => {
    if (!op?.examples?.length) return;
    const ex = op.examples[0];
    setInput(ex.input);
    if (ex.options) setOptions((o) => ({ ...o, ...ex.options }));
    toast(`Loaded example: ${ex.label}`, 'info');
  }, [op, toast]);

  if (!op) {
    return (
      <div className="page">
        <EmptyState icon="search" title={`Unknown operation “${opId}”`} hint="It may have been renamed. Browse the library to find it." />
        <button type="button" className="btn btn--primary" onClick={() => navigate('/explore')}>Back to library</button>
      </div>
    );
  }

  const cat = CATEGORIES.find((c) => c.id === op.category);
  const fav = data.favorites.includes(op.id);
  const related = relatedOps(op);
  const needsHexInput = op.input === 'bytes';

  const buildInput = (): IOValue => {
    if (needsHexInput || inputHex) {
      const bytes = hexToBytes(input);
      return { kind: 'bytes', text: input, bytes };
    }
    if (op.input === 'any') return { kind: 'text', text: input, bytes: utf8.encode(input) };
    return { kind: op.input === 'encoded' ? 'encoded' : 'text', text: input };
  };

  const run = async (actionId: string) => {
    const action = op.actions.find((a) => a.id === actionId);
    if (!action) return;
    setRunning(actionId);
    setError(null);
    try {
      const val = buildInput();
      const out = await action.run(val, options, ctx);
      setOutput(out);
      setOutputHex(false);
      void addHistory({
        opId: op.id,
        opName: op.name,
        actionLabel: action.label,
        inputPreview: input.length > 200 ? input.slice(0, 200) + '…' : input,
        outputPreview: out.text.length > 200 ? out.text.slice(0, 200) + '…' : out.text
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOutput(null);
    } finally {
      setRunning(null);
    }
  };

  const swap = () => {
    if (!output) return;
    setInput(output.bytes ? hexRenderForInput(output) : output.text);
    setInputHex(Boolean(output.bytes));
    setOutput(null);
    setError(null);
  };

  const hexRenderForInput = (v: IOValue) => v.text;

  // Spring share pop: link + ready-made invite, no page change.
  const [shareOpen, setShareOpen] = useState<{ text: string; url: string } | null>(null);
  const shareResult = (oid: string, text: string) => {
    if (text.length > SHARE_TEXT_LIMIT) {
      toast(`Result is ${text.length} chars — too long for a share link (max ${SHARE_TEXT_LIMIT}). Download it instead.`, 'err');
      return;
    }
    setShareOpen({ text, url: `${location.origin}${import.meta.env.BASE_URL}#/share/${capturedFragment(oid, text)}` });
  };
  const copyShare = async (t: string, msg: string) => {
    try { await navigator.clipboard.writeText(t); toast(msg, 'ok'); }
    catch { toast('Clipboard blocked — copy manually', 'err'); }
  };

  const actionTone = (kind: string) =>
    kind === 'decode' || kind === 'decompress' ? 'btn--violet'
    : kind === 'analyze' ? 'btn--ghost'
    : kind === 'verify' ? 'btn--ghost'
    : 'btn--primary';

  const outputText = output ? (outputHex && output.bytes ? Array.from(output.bytes, (b) => b.toString(16).padStart(2, '0')).join(' ') : output.text) : '';

  return (
    <div className="page">
      <header className="ws-head">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/explore')}>
          ← library
        </button>
        <div className="ws-head__main">
          <h1 className="page-title">{op.name}</h1>
          <div className="ws-head__chips">
            <Chip tone="dim">{cat?.name}</Chip>
            {op.oneWay ? <Chip tone="warn">one-way — no decode exists</Chip>
              : op.lossy ? <Chip tone="warn">lossy</Chip>
              : <Chip tone="cyan">reversible</Chip>}
            <Chip tone={op.engine === 'python' ? 'violet' : 'dim'}>
              {op.engine === 'python' ? 'python / pyodide' : op.engine === 'browser' ? 'browser api' : 'typescript'}
            </Chip>
            <span className="io-badge">{op.input} → {op.output}</span>
          </div>
        </div>
        <button
          type="button"
          className={`star-btn ${fav ? 'star-btn--on' : ''}`}
          aria-label="Toggle favorite"
          onClick={async () => {
            const on = await toggleFavorite(op);
            toast(on ? '★ Added to favorites' : 'Removed from favorites', 'ok');
          }}
        >
          <Icon name="star" size={20} filled={fav} />
        </button>
      </header>

      {op.warnings && op.warnings.length > 0 && (
        <div className="warn-box" role="note">
          <Icon name="shield" size={15} />
          <div>{op.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
        </div>
      )}

      {op.engine === 'python' && pyState !== 'ready' && (
        <div className={`py-banner py-banner--${pyState}`}>
          <Icon name="terminal" size={15} />
          {pyState === 'idle' && 'This operation runs on Python via Pyodide. First run downloads the runtime once (~10 MB), then everything executes locally.'}
          {pyState === 'loading' && 'Python runtime loading… (one-time download)'}
          {pyState === 'unavailable' && 'Python runtime failed to load — check your connection and retry the action.'}
        </div>
      )}

      <div className="ws-layout">
        <section className="ws-col">
          <div className="io-toolbar">
            <span className="io-toolbar__label"><Icon name="terminal" size={14} /> INPUT</span>
            <span className="io-toolbar__meta">
              {input.length} chars
              {op.input === 'any' && (
                <button type="button" className={`mini-toggle ${inputHex ? 'is-on' : ''}`} onClick={() => setInputHex(!inputHex)}>
                  {inputHex ? 'HEX' : 'TEXT'}
                </button>
              )}
              {needsHexInput && <span className="mini-toggle is-on">HEX BYTES</span>}
            </span>
          </div>
          <textarea
            ref={inputRef}
            className={`io-area ${inputHex || needsHexInput ? 'io-area--mono' : ''}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={needsHexInput ? 'Paste hexadecimal bytes, e.g. 48 65 6c 6c 6f' : 'Type or paste input…'}
            autoCapitalize="off" autoCorrect="off" spellCheck={false}
            rows={8}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') void run(op.actions[0].id); }}
          />
          <div className="io-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setInput('')} disabled={!input}>
              <Icon name="x" size={13} /> Clear
            </button>
            {op.examples && op.examples.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={loadExample}>
                <Icon name="sparkle" size={13} /> Example
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  setInput(t);
                } catch { toast('Clipboard read blocked by browser', 'err'); }
              }}
            >
              <Icon name="download" size={13} /> Paste
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              title="Load a file from this device as hexadecimal bytes (stays local)"
              onClick={() => {
                const el = document.createElement('input');
                el.type = 'file';
                el.onchange = async () => {
                  const file = el.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { toast('Pick a file under 5 MB for workspace use', 'err'); return; }
                  const buf = new Uint8Array(await file.arrayBuffer());
                  setInput(Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join(' '));
                  setInputHex(true);
                  toast(`${file.name} loaded as ${buf.length} hex bytes`, 'ok');
                };
                el.click();
              }}
            >
              <Icon name="upload" size={13} /> File → hex
            </button>
          </div>

          {op.options && op.options.length > 0 && (
            <div className="opt-grid">
              {op.options.map((f) => (
                <OptionField
                  key={f.key}
                  def={f}
                  value={options[f.key]}
                  onChange={(v) => setOptions((o) => ({ ...o, [f.key]: v }))}
                />
              ))}
            </div>
          )}

          <div className="run-row">
            {op.actions.map((a) => (
              <ScrambleButton
                key={a.id}
                label={running === a.id ? 'RUNNING…' : a.label}
                icon={running === a.id ? undefined : (a.icon ?? (a.kind === 'analyze' ? 'chart' : a.kind === 'verify' ? 'check' : a.kind === 'decode' || a.kind === 'decompress' ? 'key' : 'bolt'))}
                className={`${actionTone(a.kind)} btn--lg`}
                disabled={running !== null}
                onClick={() => void run(a.id)}
              />
            ))}
            <button
              type="button"
              className="btn btn--ghost btn--lg swap-btn"
              disabled={!output}
              onClick={swap}
              title="Send output back to input"
            >
              <Icon name="swap" size={15} /> Swap
            </button>
          </div>
          <p className="kbd-hint">Ctrl / ⌘ + Enter runs the first action</p>
        </section>

        <section className="ws-col">
          <div className="io-toolbar">
            <span className="io-toolbar__label"><Icon name="bolt" size={14} /> OUTPUT</span>
            <span className="io-toolbar__meta">
              {output?.bytes && (
                <button type="button" className={`mini-toggle ${outputHex ? 'is-on' : ''}`} onClick={() => setOutputHex(!outputHex)}>
                  {outputHex ? 'HEX' : 'VIEW'}
                </button>
              )}
              {output?.bytes && <span>{output.bytes.length} bytes</span>}
            </span>
          </div>
          {error ? (
            <div className="err-box" role="alert">
              <div className="err-box__title"><Icon name="x" size={14} /> Transformation refused</div>
              <p>{error}</p>
            </div>
          ) : output ? (
            <>
              <textarea className={`io-area io-area--out ${output.bytes ? 'io-area--mono' : ''}`} readOnly value={outputText} rows={8} />
              <div className="io-actions">
                <CopyButton text={outputText} small />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => downloadText(`${op.id}-output.txt`, outputText)}
                >
                  <Icon name="download" size={13} /> Download
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  title="Turn this result into a share link the recipient can open on VR KRYPTA"
                  onClick={() => shareResult(op.id, outputText)}
                >
                  <Icon name="link" size={13} /> Share result
                </button>
              </div>
            </>
          ) : (
            <div className="io-area io-area--out io-area--empty" aria-live="polite">
              <div className="io-placeholder">
                <Icon name="terminal" size={26} />
                <p>Awaiting input.</p>
                <p className="io-placeholder__dim">Output renders here. Nothing leaves this browser.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {(op.docs || related.length > 0) && (
        <section className="ws-docs">
          {op.docs && (
            <div className="docs-block">
              <button type="button" className="docs-toggle" onClick={() => setDocsOpen(!docsOpen)} aria-expanded={docsOpen}>
                <Icon name="info" size={14} /> How it works
                <Icon name={docsOpen ? 'chevronUp' : 'chevron'} size={14} />
              </button>
              {docsOpen && <p className="docs-body">{op.docs}</p>}
            </div>
          )}
          {related.length > 0 && (
            <div className="related-row">
              <span className="related-row__label">Related:</span>
              {related.map((r) => (
                <button key={r.id} type="button" className="fav-chip" onClick={() => navigate(`/op/${r.id}`)}>{r.name}</button>
              ))}
            </div>
          )}
        </section>
      )}

      <SpringModal open={shareOpen !== null} onClose={() => setShareOpen(null)} title="Share this result" watermarkIcon="link">
        {shareOpen && (
          <>
            <p className="smodal__tagline">One link. Nothing stored anywhere — the data rides inside the URL itself.</p>
            <div className="share__blob share__blob--code smodal__code">{shareOpen.text.length > 240 ? shareOpen.text.slice(0, 240) + '…' : shareOpen.text}</div>
            <div className="smodal__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyShare(shareOpen.text, 'Code copied')}>
                <Icon name="copy" size={13} /> Code
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copyShare(shareOpen.url, 'Link copied')}>
                <Icon name="link" size={13} /> Link
              </button>
              <button type="button" className="btn btn--primary btn--sm" style={{ flex: 1 }} onClick={() => void copyShare(capturedInvite(op.name, shareOpen.url), 'Invite copied — paste into WhatsApp / mail / anywhere')}>
                <Icon name="type" size={13} /> Copy invite
              </button>
              {typeof navigator.share === 'function' && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => void navigator.share({ title: `VR KRYPTA — ${op.name}`, text: capturedInvite(op.name, shareOpen.url) }).catch(() => undefined)}>
                  <Icon name="signal" size={13} /> Share…
                </button>
              )}
            </div>
            <p className="share__fine">Whoever opens it gets a branded page with a “Transform it here” button that loads this code into the right tool.</p>
          </>
        )}
      </SpringModal>
    </div>
  );
}
