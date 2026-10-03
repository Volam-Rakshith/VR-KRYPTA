// Smart Transformation Pipeline builder.
// Chain operations with enforced type compatibility, inspect every
// intermediate value, save locally, export/import as validated JSON.
import { useMemo, useRef, useState } from 'react';
import { allOps, getOp, CATEGORIES, isCompatible, defaultOptions } from '../operations';
import type { IOValue, OpContext } from '../operations/core/types';
import { utf8 } from '../utils/bytes';
import { runPipeline, exportPipeline, importPipeline } from '../services/pipeline';
import type { StepResult } from '../services/pipeline';
import { savePipeline, deletePipeline } from '../services/store';
import type { PipelineStep, SavedPipeline } from '../services/store';
import { useAppData } from '../hooks/useApp';
import { callPython } from '../services/python';
import { Icon } from '../ui/icons';
import { Select } from '../ui/select';
import { Chip, CopyButton, ConfirmModal, EmptyState, downloadText, useToast } from '../ui/components';
import { OptionField } from '../ui/OptionsField';

const ctx: OpContext = { python: (fn, args) => callPython<string>(fn, args) };

function newStep(opId?: string): PipelineStep {
  const first = opId ?? allOps()[0].id;
  const op = getOp(first)!;
  return { opId: first, actionId: op.actions[0].id, options: defaultOptions(op), enabled: true };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function OpSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <select className="select select--op" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Operation">
      {CATEGORIES.map((c) => (
        <optgroup key={c.id} label={c.name}>
          {allOps().filter((o) => o.category === c.id).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Pipelines() {
  const data = useAppData();
  const toast = useToast();
  const [editing, setEditing] = useState<SavedPipeline | null>(null);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [ranOk, setRanOk] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startNew = () => {
    setEditing({ id: uid(), name: 'Untitled pipeline', steps: [newStep('caesar'), newStep('base64')], updatedAt: Date.now() });
    setResults(null);
    setRanOk(null);
  };

  const startEdit = (p: SavedPipeline) => {
    setEditing({ ...p, steps: p.steps.map((s) => ({ ...s, options: { ...s.options } })) });
    setResults(null);
    setRanOk(null);
  };

  const patchStep = (i: number, patch: Partial<PipelineStep>) => {
    if (!editing) return;
    const steps = editing.steps.map((s, k) => (k === i ? { ...s, ...patch } : s));
    setEditing({ ...editing, steps });
  };

  const moveStep = (i: number, dir: -1 | 1) => {
    if (!editing) return;
    const j = i + dir;
    if (j < 0 || j >= editing.steps.length) return;
    const steps = [...editing.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setEditing({ ...editing, steps });
  };

  const compatError = useMemo(() => {
    if (!editing) return null;
    for (let i = 0; i < editing.steps.length - 1; i++) {
      const a = editing.steps[i], b = editing.steps[i + 1];
      if (!a.enabled || !b.enabled) continue;
      const opA = getOp(a.opId), opB = getOp(b.opId);
      if (!opA || !opB) return 'A step references a missing operation.';
      if (!isCompatible(opA.output, opB.input)) {
        return `Step ${i + 1} (${opA.name}) outputs ${opA.output.toUpperCase()} but step ${i + 2} (${opB.name}) needs ${opB.input.toUpperCase()} — insert an explicit conversion (e.g. “Text → Bytes”).`;
      }
    }
    return null;
  }, [editing]);

  const run = async () => {
    if (!editing || editing.steps.length === 0) return;
    setRunning(true);
    setResults(null);
    setRanOk(null);
    try {
      const value: IOValue = { kind: 'text', text: input, bytes: utf8.encode(input) };
      const res = await runPipeline(editing.steps, value, ctx);
      setResults(res.results);
      setRanOk(res.ok);
      if (res.ok) toast('Pipeline completed', 'ok');
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast('Give the pipeline a name first', 'err'); return; }
    if (editing.steps.length === 0) { toast('Pipeline needs at least one step', 'err'); return; }
    await savePipeline(editing);
    toast(`Saved “${editing.name}” locally`, 'ok');
  };

  const exportJson = () => {
    if (!editing) return;
    downloadText(`${editing.name.replace(/\s+/g, '-').toLowerCase()}.krypta.json`, exportPipeline(editing), 'application/json');
    toast('Pipeline exported as JSON', 'ok');
  };

  const doImport = (text: string) => {
    try {
      const p = importPipeline(text);
      setEditing({ id: uid(), name: p.name, steps: p.steps, updatedAt: Date.now() });
      setShowImport(false);
      setImportText('');
      setResults(null);
      toast(`Imported “${p.name}” (${p.steps.length} steps)`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'err');
    }
  };

  /* ------------------------------ LIST VIEW ------------------------------ */
  if (!editing) {
    return (
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">PIPELINE LAB</h1>
          <p className="page-sub">Chain operations into reproducible transformation sequences. Saved locally, portable as JSON — never executable code.</p>
        </header>
        <div className="pipeline-actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={startNew}>
            <Icon name="plus" size={16} /> New pipeline
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => setShowImport(!showImport)}>
            <Icon name="upload" size={15} /> Import JSON
          </button>
        </div>

        {showImport && (
          <div className="import-box">
            <textarea
              className="io-area"
              rows={5}
              placeholder='Paste a VR KRYPTA pipeline export ({"format":"vr-krypta/pipeline", …})'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              spellCheck={false}
            />
            <div className="io-actions">
              <button type="button" className="btn btn--primary" onClick={() => doImport(importText)} disabled={!importText.trim()}>
                Validate & import
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={14} /> From file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) doImport(await f.text());
                  e.target.value = '';
                }}
              />
            </div>
            <p className="opt__help">Imports are strictly validated: every step must reference a real operation and action. Pipeline files contain configuration data only — no code is ever executed from an import.</p>
          </div>
        )}

        {data.pipelines.length === 0 ? (
          <EmptyState icon="layers" title="No saved pipelines" hint="Build one — e.g. Text → Caesar cipher → Base64 — and it will live here, in this browser only." />
        ) : (
          <div className="pipeline-list">
            {data.pipelines.map((p) => (
              <article key={p.id} className="pipeline-card">
                <button type="button" className="pipeline-card__open" onClick={() => startEdit(p)}>
                  <h3 className="pipeline-card__name">{p.name}</h3>
                  <div className="pipeline-card__steps">
                    {p.steps.slice(0, 6).map((s, i) => (
                      <span key={i} className="pipe-mini">
                        {getOp(s.opId)?.name ?? s.opId}
                        {i < Math.min(p.steps.length, 6) - 1 && <Icon name="arrowRight" size={11} />}
                      </span>
                    ))}
                    {p.steps.length > 6 && <span className="pipe-mini">+{p.steps.length - 6}</span>}
                  </div>
                  <span className="pipeline-card__meta">{p.steps.length} steps · updated {new Date(p.updatedAt).toLocaleDateString()}</span>
                </button>
                <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => setConfirmDelete(p.id)}>
                  <Icon name="trash" size={14} />
                </button>
              </article>
            ))}
          </div>
        )}

        <ConfirmModal
          open={confirmDelete !== null}
          title="Delete pipeline?"
          body="This removes the saved pipeline from this browser. This cannot be undone."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            if (confirmDelete) await deletePipeline(confirmDelete);
            setConfirmDelete(null);
            toast('Pipeline deleted', 'ok');
          }}
        />
      </div>
    );
  }

  /* ------------------------------ EDITOR VIEW ----------------------------- */
  return (
    <div className="page">
      <header className="ws-head">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditing(null); setResults(null); }}>
          ← pipelines
        </button>
        <input
          className="input input--name"
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value.slice(0, 80) })}
          aria-label="Pipeline name"
        />
        <div className="io-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void save()}><Icon name="check" size={13} /> Save</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={exportJson}><Icon name="download" size={13} /> Export</button>
        </div>
      </header>

      <div className="pipe-chain">
        {editing.steps.map((step, i) => {
          const op = getOp(step.opId);
          return (
            <div key={i} className={`pipeline-step ${step.enabled ? '' : 'pipeline-step--off'}`}>
              <div className="pipeline-step__rail">
                <span className="pipe-node">{i + 1}</span>
                {i < editing.steps.length - 1 && <span className="pipe-wire" />}
              </div>
              <div className="pipeline-step__body">
                <div className="pipeline-step__head">
                  <OpSelect
                    value={step.opId}
                    onChange={(id) => {
                      const o = getOp(id)!;
                      patchStep(i, { opId: id, actionId: o.actions[0].id, options: defaultOptions(o) });
                    }}
                  />
                  <Select
                    className="sel--action"
                    value={step.actionId}
                    onChange={(v) => patchStep(i, { actionId: v })}
                    ariaLabel="Action"
                    options={op?.actions.map((a) => ({ value: a.id, label: a.label })) ?? []}
                    maxHeight={200}
                  />
                  <div className="pipeline-step__tools">
                    <label className="toggle" title="Enable / disable step">
                      <input type="checkbox" checked={step.enabled} onChange={(e) => patchStep(i, { enabled: e.target.checked })} />
                      <span className="toggle__track" />
                    </label>
                    <button type="button" className="icon-btn" onClick={() => moveStep(i, -1)} disabled={i === 0} aria-label="Move up"><Icon name="chevronUp" size={14} /></button>
                    <button type="button" className="icon-btn" onClick={() => moveStep(i, 1)} disabled={i === editing.steps.length - 1} aria-label="Move down"><Icon name="chevron" size={14} /></button>
                    <button
                      type="button" className="icon-btn" aria-label="Duplicate step"
                      onClick={() => setEditing({ ...editing, steps: [...editing.steps.slice(0, i + 1), { ...step, options: { ...step.options } }, ...editing.steps.slice(i + 1)] })}
                    ><Icon name="copy" size={14} /></button>
                    <button
                      type="button" className="icon-btn icon-btn--danger" aria-label="Remove step"
                      onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, k) => k !== i) })}
                    ><Icon name="trash" size={14} /></button>
                  </div>
                </div>
                {op && op.options && op.options.length > 0 && step.enabled && (
                  <div className="opt-grid opt-grid--compact">
                    {op.options.map((f) => (
                      <OptionField key={f.key} def={f} value={step.options[f.key]} onChange={(v) => patchStep(i, { options: { ...step.options, [f.key]: v } })} />
                    ))}
                  </div>
                )}
                {op && <div className="pipeline-step__io">expects {op.input.toUpperCase()} → produces {op.output.toUpperCase()}</div>}
              </div>
            </div>
          );
        })}
        <button type="button" className="btn btn--ghost pipe-add" onClick={() => setEditing({ ...editing, steps: [...editing.steps, newStep()] })}>
          <Icon name="plus" size={15} /> Add step
        </button>
      </div>

      {compatError && (
        <div className="warn-box" role="alert"><Icon name="shield" size={15} /><p>{compatError}</p></div>
      )}

      <section className="pipe-run">
        <div className="io-toolbar"><span className="io-toolbar__label"><Icon name="terminal" size={14} /> PIPELINE INPUT (text)</span></div>
        <textarea
          className="io-area" rows={4} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Feed the chain…" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        />
        <div className="run-row">
          <button type="button" className="btn btn--primary btn--lg" disabled={running || editing.steps.length === 0 || Boolean(compatError)} onClick={() => void run()}>
            {running ? <span className="spinner" /> : <Icon name="play" size={15} />} Run pipeline
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => { setResults(null); setRanOk(null); }} disabled={!results}>
            <Icon name="x" size={14} /> Clear results
          </button>
        </div>
      </section>

      {results && (
        <section className="pipe-results">
          <h2 className="section-title">
            <Icon name={ranOk ? 'check' : 'x'} size={15} />
            {ranOk ? 'Chain complete — inspect every hop' : 'Chain halted'}
          </h2>
          {results.map((r, i) => (
            <div key={i} className={`pipe-result ${r.error ? 'pipe-result--err' : ''} ${r.skipped ? 'pipe-result--skip' : ''}`}>
              <div className="pipe-result__head">
                <span className="pipe-node">{i + 1}</span>
                <span className="pipe-result__name">{r.op?.name ?? r.step.opId}</span>
                {r.skipped && <Chip tone="dim">skipped (disabled)</Chip>}
                {r.error ? <Chip tone="warn">error</Chip> : !r.skipped && <Chip tone="cyan">{r.value?.kind}</Chip>}
                {r.value && !r.error && <CopyButton text={r.value.text} small label="Copy hop" />}
              </div>
              {r.error ? (
                <p className="pipe-result__error">{r.error}</p>
              ) : (
                !r.skipped && r.value && (
                  <pre className="pipe-result__value">{r.value.text.length > 800 ? r.value.text.slice(0, 800) + '\n…(truncated preview)' : r.value.text || '(empty)'}</pre>
                )
              )}
            </div>
          ))}
          {ranOk && results.length > 0 && (
            <div className="pipe-final">
              <span>FINAL OUTPUT</span>
              <CopyButton text={results[results.length - 1]?.value?.text ?? ''} small />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
