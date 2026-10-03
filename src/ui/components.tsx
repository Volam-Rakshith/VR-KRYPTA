// Shared UI primitives: toast bus, copy button, panel frames, confirm modal.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';

/* ---------------------------------- TOAST --------------------------------- */

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'err' | 'info';
}

const ToastCtx = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon name={t.tone === 'ok' ? 'check' : t.tone === 'err' ? 'x' : 'info'} size={14} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* --------------------------------- COPY ----------------------------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = 'Copy', small }: { text: string; label?: string; small?: boolean }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn--ghost ${small ? 'btn--sm' : ''} ${done ? 'btn--ok' : ''}`}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          toast('Copied to clipboard', 'ok');
          setTimeout(() => setDone(false), 1200);
        } else toast('Copy failed — clipboard blocked', 'err');
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={14} /> {done ? 'Copied' : label}
    </button>
  );
}

/* ------------------------------- CONFIRM MODAL ----------------------------- */

export function ConfirmModal(props: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props]);

  if (!props.open) return null;
  return (
    <div className="modal-backdrop" onClick={props.onCancel} role="presentation">
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{props.title}</h3>
        <p className="modal__body">{props.body}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={props.onCancel}>Cancel</button>
          <button type="button" className={`btn ${props.danger ? 'btn--danger' : 'btn--primary'}`} onClick={props.onConfirm}>
            {props.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- MISC ---------------------------------- */

export function Chip({ children, tone }: { children: ReactNode; tone?: 'cyan' | 'violet' | 'warn' | 'dim' }) {
  return <span className={`chip chip--${tone ?? 'dim'}`}>{children}</span>;
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon name={icon} size={34} /></div>
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
    </div>
  );
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
