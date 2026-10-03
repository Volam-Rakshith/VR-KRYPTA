// Spring modal — pops in from shrunken+tilted, blurs the world behind it,
// carries a giant translucent watermark glyph. CSS-driven (a micro-JSX of
// the framer "spring modal" idea), reduced-motion turns the pop into a fade.
import { useEffect, useRef } from 'react';
import { Icon } from './icons';

interface SpringModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  watermarkIcon?: string;
  children: React.ReactNode;
  wide?: boolean;
}

export function SpringModal({ open, onClose, title, watermarkIcon = 'link', children, wide }: SpringModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="smodal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={cardRef}
        className={`smodal__card ${wide ? 'smodal__card--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <Icon name={watermarkIcon} size={220} className="smodal__watermark" />
        <button type="button" className="smodal__close" onClick={onClose} aria-label="Close dialog">
          <Icon name="x" size={15} />
        </button>
        <h3 className="smodal__title">{title}</h3>
        <div className="smodal__body">{children}</div>
      </div>
    </div>
  );
}
