// LEARN MODE — the library's teaching wing. Every one of the 190 operations
// gets a sectional card (what, how it works, live examples, history, uses,
// limits, security) plus a built-in playground so you learn by doing.
import { useEffect, useMemo, useState } from 'react';
import { learnCard, learnExamples, learnIds, CURATED } from '../services/learn';
import type { LearnCard, LearnExample } from '../services/learn';
import { getOp, CATEGORIES } from '../operations/core/registry';
import type { OperationDefinition } from '../operations/core/types';
import { Icon } from '../ui/icons';
import { useToast, copyText } from '../ui/components';
import { navigate } from '../hooks/useApp';
import '../operations';

const SECTION_META: { key: keyof Pick<LearnCard, 'what' | 'history' | 'security'>; title: string; icon: string }[] = [];
void SECTION_META; // sections rendered explicitly below for layout control

export function Learn({ opId }: { opId?: string }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(opId ?? 'morse');
  const [card, setCard] = useState<LearnCard | null>(null);
  const [examples, setExamples] = useState<LearnExample[]>([]);
  const [playIn, setPlayIn] = useState('');
  const [playOut, setPlayOut] = useState<{ label: string; text: string; err?: boolean } | null>(null);
  const [playBusy, setPlayBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (opId && opId !== selectedId) setSelectedId(opId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opId]);

  useEffect(() => {
    setCard(learnCard(selectedId));
    setExamples([]);
    setPlayOut(null);
    void learnExamples(selectedId).then(setExamples);
  }, [selectedId]);

  const ops = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ids = learnIds();
    const matched = ids
      .map((id) => getOp(id))
      .filter((op): op is OperationDefinition => !!op)
      .filter((op) =>
        !q ||
        op.name.toLowerCase().includes(q) ||
        op.id.includes(q) ||
        (op.tags ?? []).some((t) => t.includes(q)) ||
        (op.aliases ?? []).some((a) => a.includes(q))
      );
    return matched;
  }, [query]);

  const run = async (index: number) => {
    const op = getOp(selectedId);
    if (!op) return;
    const action = op.actions[index];
    if (!action) return;
    setPlayBusy(true);
    try {
      const opts: Record<string, unknown> = {};
      for (const f of op.options ?? []) opts[f.key] = f.type === 'number' ? (f.default ?? 0) : (f as { default?: unknown }).default;
      const res = await action.run(
        { kind: 'text', text: playIn },
        opts,
        { python: async () => { throw new Error('Open this in the Workspace to use the Python engine.'); } }
      );
      setPlayOut({ label: action.label, text: res.text });
    } catch (e) {
      setPlayOut({ label: action.label, text: e instanceof Error ? e.message : String(e), err: true });
    } finally {
      setPlayBusy(false);
    }
  };

  const selected = getOp(selectedId);

  return (
    <div className="lrn page">
      <header className="det-head">
        <h1 className="page-title"><Icon name="flask" size={22} /> LEARN MODE</h1>
        <p className="page-sub">
          Every operation explained: what it is, how it works step-by-step, its history, live examples,
          real-world uses, limits, and security notes — with a built-in playground to try while reading.
        </p>
      </header>

      <div className="lrn__grid">
        <aside className="lrn__side">
          <div className="lrn__searchbox">
            <Icon name="search" size={14} />
            <input
              className="lrn__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 190 ops…"
              aria-label="Search operations"
            />
          </div>
          <div className="lrn__list">
            {CATEGORIES.map((c) => {
              const rows = ops.filter((o) => o.category === c.id);
              if (rows.length === 0) return null;
              return (
                <div key={c.id} className="lrn__cat">
                  <div className="lrn__cat-head">
                    <Icon name={c.icon} size={12} /> {c.name}
                    <span className="lrn__cat-count">{rows.length}</span>
                  </div>
                  {rows.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`lrn__op ${o.id === selectedId ? 'lrn__op--on' : ''}`}
                      onClick={() => { setSelectedId(o.id); navigate('/learn/' + o.id); }}
                    >
                      <span className="lrn__op-name">{o.name}</span>
                      {CURATED[o.id] && <span className="lrn__badge">DEEP DIVE</span>}
                    </button>
                  ))}
                </div>
              );
            })}
            {ops.length === 0 && <p className="lrn__none">Nothing matches “{query}”.</p>}
          </div>
        </aside>

        <main className="lrn__main">
          {card && selected && (
            <article className="lrn__card">
              <header className="lrn__head">
                <div>
                  <h2 className="lrn__title">{card.name}</h2>
                  <div className="lrn__chips">
                    <span className="lrn__chip">{CATEGORIES.find((c) => c.id === card.category)?.name}</span>
                    <span className="lrn__chip">{card.engine === 'python' ? '🐍 python engine' : '⚡ typescript'}</span>
                    {card.oneWay && <span className="lrn__chip lrn__chip--warn">one-way</span>}
                    {!card.oneWay && card.reversible && <span className="lrn__chip lrn__chip--ok">reversible</span>}
                    <span className={`lrn__chip ${card.curated ? 'lrn__chip--deep' : ''}`}>{card.curated ? '★ DEEP DIVE' : 'AUTO PROFILE'}</span>
                  </div>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/op/' + card.opId)}>
                  <Icon name="arrowRight" size={12} /> OPEN IN STUDIO
                </button>
              </header>

              <section className="lrn__section">
                <h3 className="lrn__h"><Icon name="info" size={13} /> WHAT IS THIS</h3>
                <p className="lrn__text">{card.what}</p>
              </section>

              <section className="lrn__section">
                <h3 className="lrn__h"><Icon name="wand" size={13} /> HOW IT WORKS</h3>
                <ol className="lrn__steps">
                  {card.howSteps.map((s, i) => <li key={i}><span className="lrn__step-n">{i + 1}</span> {s}</li>)}
                </ol>
              </section>

              {examples.length > 0 && (
                <section className="lrn__section">
                  <h3 className="lrn__h"><Icon name="star" size={13} /> SEE IT LIVE — REAL RUNS</h3>
                  {examples.map((ex, i) => (
                    <div key={i} className={`lrn__ex ${ex.err ? 'lrn__ex--err' : ''}`}>
                      <div className="lrn__ex-label">{ex.label}</div>
                      <div className="lrn__ex-row">
                        <div className="lrn__ex-box">
                          <span className="lrn__ex-tag">IN</span>
                          <code>{ex.input.length > 240 ? ex.input.slice(0, 240) + '…' : ex.input}</code>
                        </div>
                        <span className="lrn__ex-arrow">→</span>
                        <div className="lrn__ex-box">
                          <span className="lrn__ex-tag">OUT</span>
                          <code>{ex.output}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              <section className="lrn__section">
                <h3 className="lrn__h"><Icon name="history" size={13} /> HISTORY</h3>
                <p className="lrn__text">{card.history}</p>
              </section>

              <div className="lrn__split">
                <section className="lrn__section">
                  <h3 className="lrn__h"><Icon name="bolt" size={13} /> WHERE IT'S USED</h3>
                  <ul className="lrn__bullets">
                    {card.uses.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </section>
                <section className="lrn__section">
                  <h3 className="lrn__h"><Icon name="shield" size={13} /> LIMITS &amp; EDGE CASES</h3>
                  <ul className="lrn__bullets">
                    {card.limits.length === 0 && <li>No known traps beyond the obvious.</li>}
                    {card.limits.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </section>
              </div>

              <section className="lrn__section lrn__section--sec">
                <h3 className="lrn__h"><Icon name="key" size={13} /> SECURITY NOTES</h3>
                <p className="lrn__text">{card.security}</p>
              </section>

              <section className="lrn__section lrn__play">
                <h3 className="lrn__h"><Icon name="flask" size={13} /> PLAYGROUND — TRY IT WHILE YOU LEARN</h3>
                <textarea
                  className="lrn__play-in"
                  value={playIn}
                  onChange={(e) => setPlayIn(e.target.value)}
                  placeholder="Type anything here, then hit an action chip below it…"
                  rows={3}
                  spellCheck={false}
                />
                <div className="lrn__play-actions">
                  {selected.actions.map((a, i) => (
                    <button key={a.id} type="button" className="btn btn--ghost btn--sm" disabled={playBusy} onClick={() => void run(i)}>
                      <Icon name={a.icon ?? 'play'} size={11} /> {a.label}
                    </button>
                  ))}
                </div>
                {playOut && (
                  <div className={`lrn__play-out ${playOut.err ? 'lrn__play-out--err' : ''}`}>
                    <div className="lrn__play-out-head">
                      <span>{playOut.label}</span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={async () => {
                          if (await copyText(playOut.text)) toast('Output copied', 'ok');
                          else toast('Copy failed', 'err');
                        }}
                      >
                        <Icon name="copy" size={11} /> COPY
                      </button>
                    </div>
                    <pre>{playOut.text || '(empty output)'}</pre>
                  </div>
                )}
                <p className="lrn__play-note">
                  <Icon name="info" size={10} /> Playground uses each action's default options — open in the
                  Studio for full control, pipelines and files.
                </p>
              </section>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
