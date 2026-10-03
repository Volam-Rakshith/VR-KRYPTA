import { useMemo } from 'react';
import { opCount, CATEGORIES, categoryCount, getOp } from '../operations';
import { useAppData, usePrefs, navigate } from '../hooks/useApp';
import { Icon } from '../ui/icons';
import { CopyButton, Chip, EmptyState } from '../ui/components';
import { TiltLogo, VelocityMarquee } from '../ui/fx';

function greeting(name: string | null): string {
  if (!name) return 'WELCOME BACK.';
  return `WELCOME BACK, ${name.toUpperCase()}.`;
}

export function Dashboard() {
  const prefs = usePrefs();
  const data = useAppData();

  const favorites = useMemo(
    () => data.favorites.map((id) => getOp(id)).filter(Boolean),
    [data.favorites]
  );

  return (
    <div className="page page--dashboard">
      <section className="hero">
        <div className="hero__glitch" aria-hidden="true">VR KRYPTA</div>
        <div className="hero__logo"><TiltLogo size={118} /></div>
        <h1 className="hero__title">VR KRYPTA</h1>
        <p className="hero__studio">A VR DEVELOPMENTS PROJECT</p>
        <p className="hero__tagline">THE UNIVERSAL INFORMATION TRANSFORMATION TOOLKIT</p>
        <p className="hero__mantra">TRANSFORM&nbsp;&nbsp;•&nbsp;&nbsp;DECIPHER&nbsp;&nbsp;•&nbsp;&nbsp;ANALYZE</p>
        <div className="hero__greet">
          <span className="hero__greet-name">{greeting(prefs.name)}</span>
          <span className="hero__greet-q">WHAT ARE WE TRANSFORMING TODAY?</span>
        </div>
        <div className="hero__stats">
          <div className="stat"><span className="stat__num">{opCount()}</span><span className="stat__label">operations</span></div>
          <div className="stat"><span className="stat__num">{CATEGORIES.length}</span><span className="stat__label">categories</span></div>
          <div className="stat"><span className="stat__num">{data.favorites.length}</span><span className="stat__label">favorites</span></div>
          <div className="stat"><span className="stat__num">{data.pipelines.length}</span><span className="stat__label">pipelines</span></div>
        </div>
        <div className="hero__cta">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => navigate('/explore')}>
            <Icon name="search" size={16} /> Explore operations
          </button>
          <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate('/pipelines')}>
            <Icon name="layers" size={16} /> Build a pipeline
          </button>
        </div>
        <p className="hero__privacy">
          <Icon name="shield" size={13} /> LOCAL-FIRST — transformations run in your browser. No accounts, no uploads.
        </p>
      </section>

      <VelocityMarquee text={`TRANSFORM • DECIPHER • ANALYZE • ${opCount()} OPERATIONS • ONE BROWSER • ZERO UPLOADS • VR KRYPTA BY VR DEVELOPMENTS •`} />

      <section className="dash-section">
        <h2 className="section-title"><Icon name="grid" size={16} /> Categories</h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="cat-card" onClick={() => navigate(`/explore/${c.id}`)}>
              <div className="cat-card__icon"><Icon name={c.icon} size={22} /></div>
              <div className="cat-card__name">{c.name}</div>
              <div className="cat-card__blurb">{c.blurb}</div>
              <div className="cat-card__count">{categoryCount(c.id)} ops →</div>
            </button>
          ))}
        </div>
      </section>

      {favorites.length > 0 && (
        <section className="dash-section">
          <h2 className="section-title"><Icon name="star" size={16} /> Favorites</h2>
          <div className="fav-row">
            {favorites.map((op) => op && (
              <button key={op.id} type="button" className="fav-chip" onClick={() => navigate(`/op/${op.id}`)}>
                <Icon name={CATEGORIES.find((c) => c.id === op.category)?.icon ?? 'bolt'} size={13} />
                {op.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="dash-section">
        <h2 className="section-title"><Icon name="history" size={16} /> Recent transformations</h2>
        {data.history.length === 0 ? (
          <EmptyState icon="clock" title="Nothing yet" hint="Run any operation and it will show up here — stored only in this browser." />
        ) : (
          <div className="history-list">
            {data.history.slice(0, 6).map((h, i) => (
              <button key={`${h.ts}-${i}`} type="button" className="history-item" onClick={() => {
                sessionStorage.setItem(`vrk:prefill:${h.opId}`, JSON.stringify({ text: h.input ?? h.inputPreview.replace(/…$/, ''), options: h.options }));
                navigate(`/op/${h.opId}`);
              }}>
                <div className="history-item__main">
                  <span className="history-item__op">{h.opName}</span>
                  <Chip tone="cyan">{h.actionLabel}</Chip>
                </div>
                <div className="history-item__prev">
                  <span className="history-item__io">{h.inputPreview}</span>
                  <Icon name="arrowRight" size={12} />
                  <span className="history-item__io">{h.outputPreview}</span>
                </div>
                <div className="history-item__time">{new Date(h.ts).toLocaleString()}</div>
                <CopyButton text={h.outputPreview} small />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
