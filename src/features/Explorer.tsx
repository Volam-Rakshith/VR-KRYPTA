// Operation Explorer: searchable, filterable, keyboard-navigable library.
import { useEffect, useMemo, useRef, useState } from 'react';
import { allOps, searchOps, CATEGORIES, getOp, opCount } from '../operations';
import type { CategoryId, OperationDefinition } from '../operations/core/types';
import { navigate, useAppData } from '../hooks/useApp';
import { toggleFavorite } from '../services/store';
import { Icon } from '../ui/icons';
import { Chip, EmptyState, useToast } from '../ui/components';

export function OpCard({ op, focused, onFocus }: { op: OperationDefinition; focused?: boolean; onFocus?: () => void }) {
  const data = useAppData();
  const toast = useToast();
  const fav = data.favorites.includes(op.id);
  const cat = CATEGORIES.find((c) => c.id === op.category);
  return (
    <article
      className={`op-card ${focused ? 'op-card--focused' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`Open ${op.name}`}
      onFocus={onFocus}
      onClick={() => navigate(`/op/${op.id}`)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/op/${op.id}`); } }}
    >
      <div className="op-card__top">
        <span className="op-card__icon"><Icon name={cat?.icon ?? 'bolt'} size={17} /></span>
        <h3 className="op-card__name">{op.name}</h3>
        <button
          type="button"
          className={`op-card__fav ${fav ? 'op-card__fav--on' : ''}`}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
          onClick={async (e) => {
            e.stopPropagation();
            const on = await toggleFavorite(op);
            toast(on ? `★ ${op.name} added to favorites` : `Removed ${op.name} from favorites`, 'ok');
          }}
        >
          <Icon name="star" size={15} filled={fav} />
        </button>
      </div>
      <p className="op-card__desc">{op.description}</p>
      <div className="op-card__meta">
        <Chip tone="dim">{cat?.name ?? op.category}</Chip>
        {op.oneWay ? <Chip tone="warn">one-way</Chip> : op.lossy ? <Chip tone="warn">lossy</Chip> : <Chip tone="cyan">reversible</Chip>}
        {op.engine === 'python' && <Chip tone="violet">python</Chip>}
        <span className="op-card__io">{op.input} → {op.output}</span>
      </div>
    </article>
  );
}

const ENGINE_FILTERS = [
  { value: 'all', label: 'All engines' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'browser', label: 'Browser API' },
  { value: 'python', label: 'Python' }
] as const;

export function Explorer({ initialCategory }: { initialCategory?: string }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>(
    CATEGORIES.some((c) => c.id === initialCategory) ? (initialCategory as CategoryId) : 'all'
  );
  const [revOnly, setRevOnly] = useState(false);
  const [oneWayOnly, setOneWayOnly] = useState(false);
  const [engine, setEngine] = useState<'all' | 'typescript' | 'browser' | 'python'>('all');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useAppData();

  useEffect(() => {
    if (initialCategory && CATEGORIES.some((c) => c.id === initialCategory)) setCategory(initialCategory as CategoryId);
  }, [initialCategory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(
    () => searchOps(query, { category, reversibleOnly: revOnly, oneWayOnly, engine }),
    [query, category, revOnly, oneWayOnly, engine]
  );

  const favorites = data.favorites.map((id) => getOp(id)).filter(Boolean) as OperationDefinition[];
  const showFavSection = !query && category === 'all' && !revOnly && !oneWayOnly && engine === 'all' && favorites.length > 0;

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setFocusedIdx(0);
      document.querySelector<HTMLElement>('.op-card')?.focus();
    } else if (e.key === 'Enter' && results.length > 0) {
      navigate(`/op/${results[0].id}`);
    }
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setFocusedIdx(-1); inputRef.current?.focus(); return; }
    const cols = window.innerWidth >= 1100 ? 3 : window.innerWidth >= 700 ? 2 : 1;
    let next = focusedIdx;
    if (e.key === 'ArrowRight') next = Math.min(results.length - 1, focusedIdx + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, focusedIdx - 1);
    else if (e.key === 'ArrowDown') next = Math.min(results.length - 1, focusedIdx + cols);
    else if (e.key === 'ArrowUp') next = Math.max(0, focusedIdx - cols);
    else return;
    e.preventDefault();
    setFocusedIdx(next);
    document.querySelectorAll<HTMLElement>('.op-card')[next]?.focus();
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">OPERATION LIBRARY</h1>
        <p className="page-sub">{opCount()} operations across {CATEGORIES.length} categories — every one implemented and tested, no placeholders.</p>
      </header>

      <div className="explorer-bar">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder='Search operations… try "morse", "hash", "hex", "decompress"   ( / to focus )'
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            aria-label="Search operations"
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <div className="filter-row" role="group" aria-label="Filters">
          <button type="button" className={`filter-chip ${category === 'all' ? 'is-on' : ''}`} onClick={() => setCategory('all')}>All</button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`filter-chip ${category === c.id ? 'is-on' : ''}`}
              onClick={() => setCategory(category === c.id ? 'all' : c.id)}
            >
              <Icon name={c.icon} size={12} /> {c.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="toggle">
            <input type="checkbox" checked={revOnly} onChange={(e) => { setRevOnly(e.target.checked); if (e.target.checked) setOneWayOnly(false); }} />
            <span className="toggle__track" /> reversible
          </label>
          <label className="toggle">
            <input type="checkbox" checked={oneWayOnly} onChange={(e) => { setOneWayOnly(e.target.checked); if (e.target.checked) setRevOnly(false); }} />
            <span className="toggle__track" /> one-way
          </label>
          <select className="select" value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)} aria-label="Engine filter">
            {ENGINE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {showFavSection && (
        <>
          <h2 className="section-title"><Icon name="star" size={15} /> Your favorites</h2>
          <div className="op-grid op-grid--fav">
            {favorites.map((op) => <OpCard key={op.id} op={op} />)}
          </div>
        </>
      )}

      <h2 className="section-title">
        <Icon name="grid" size={15} />
        {query ? `${results.length} result${results.length === 1 ? '' : 's'} for “${query}”` : `${results.length} operations`}
      </h2>

      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title="No operations match"
          hint="Try a shorter term, an alias (“b64”, “telegraph”, “phone”), or clear the filters."
        />
      ) : (
        <div className="op-grid" onKeyDown={onGridKey}>
          {results.map((op, i) => (
            <OpCard key={op.id} op={op} focused={i === focusedIdx} onFocus={() => setFocusedIdx(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
