// Fancy select — custom animated dropdown replacing native <select>.
// Staggered item reveal from the top, rotating chevron, outside-click and
// Escape to close, ArrowUp/Down + Enter keyboard support, full a11y roles.
import { useEffect, useId, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Max panel height before scrolling */
  maxHeight?: number;
}

export function Select({ value, options, onChange, ariaLabel, className, maxHeight = 280 }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      } else {
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && open && active >= 0) {
      e.preventDefault();
      pick(options[active].value);
    }
  };

  return (
    <div ref={rootRef} className={`sel ${open ? 'sel--open' : ''} ${className ?? ''}`} onKeyDown={onTriggerKey}>
      <button
        type="button"
        className="sel__trigger"
        onClick={() => { setOpen((p) => !p); setActive(options.findIndex((o) => o.value === value)); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="sel__value">{current ? current.label : '—'}</span>
        <svg className="sel__chev" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="sel__panel" role="listbox" aria-label={ariaLabel} style={{ maxHeight }} tabIndex={-1}>
          {options.map((o, i) => (
            <li key={o.value} role="presentation">
              <button
                type="button"
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`sel__item ${o.value === value ? 'sel__item--on' : ''} ${i === active ? 'sel__item--active' : ''}`}
                style={{ animationDelay: `${Math.min(i * 28, 320)}ms` }}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActive(i)}
              >
                {o.value === value && <span className="sel__dot" aria-hidden="true" />}
                <span className="sel__item-label">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
