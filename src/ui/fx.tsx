// Ambient FX layers: custom cursor, particle grid background, boot sequence.
// Everything respects prefers-reduced-motion and the user's FX toggle, is
// pointer-fine only, and never blocks interaction (pointer-events: none).
import { useEffect, useRef, useState } from 'react';
import { getPrefs } from '../services/store';
import { BrandMark } from './icons';

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function finePointer(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/* --------------------------------- CURSOR --------------------------------- */

export function CursorFX() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!finePointer() || reducedMotion() || !getPrefs().motionFx) return;
    document.body.classList.add('has-cursorfx');
    let x = -100, y = -100, rx = -100, ry = -100;
    let raf = 0;
    const center = (px: number, py: number) => `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY; };
    const tick = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      if (dot.current) dot.current.style.transform = center(x, y);
      if (ring.current) ring.current.style.transform = center(rx, ry);
      raf = requestAnimationFrame(tick);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const hot = !!t.closest('a, button, [role="button"], input, textarea, select, .op-card, .pipeline-step, .brandmark-img');
      ring.current?.classList.toggle('cursor-hot', hot);
      dot.current?.classList.toggle('cursor-hot', hot);
    };
    const onDown = (e: MouseEvent) => {
      ring.current?.classList.add('cursor-press');
      dot.current?.classList.add('cursor-press');
      spawnRipple(e.clientX, e.clientY);
    };
    const onUp = () => {
      ring.current?.classList.remove('cursor-press');
      dot.current?.classList.remove('cursor-press');
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      document.body.classList.remove('has-cursorfx');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!finePointer()) return null;
  return (
    <>
      <div ref={ring} className="cursor-ring" aria-hidden="true" />
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  );
}

/** Expanding ring at every click — direct confirmation that the click registered. */
function spawnRipple(x: number, y: number) {
  const el = document.createElement('div');
  el.className = 'click-ripple';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/** Hero logo with a gentle pointer-parallax tilt. */
export function TiltLogo({ size = 120 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = finePointer() && !reducedMotion();
  return (
    <div
      ref={ref}
      className="tilt-logo"
      style={{ perspective: '600px' }}
      onMouseMove={(e) => {
        if (!enabled || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        ref.current.style.transform = `rotateY(${dx * 10}deg) rotateX(${-dy * 10}deg)`;
      }}
      onMouseLeave={() => { if (ref.current) ref.current.style.transform = 'rotateY(0) rotateX(0)'; }}
    >
      <BrandMark size={size} />
    </div>
  );
}

/* -------------------------------- BACKGROUND ------------------------------ */

const GLYPHS = '01·+-×=><{}[]#$%&@?!ΛΣΠΔ';

export function BackgroundFX() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || reducedMotion() || !getPrefs().motionFx) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, raf = 0, last = 0, visible = true;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    interface P { x: number; y: number; vy: number; ch: string; size: number; hue: number; alpha: number }
    let parts: P[] = [];

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * DPR;
      cv.height = h * DPR;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const budget = Math.min(70, Math.floor((w * h) / 26000));
      parts = Array.from({ length: budget }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vy: 0.15 + Math.random() * 0.5,
        ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        size: 10 + Math.random() * 14,
        hue: Math.random(),
        alpha: 0.05 + Math.random() * 0.16
      }));
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      if (t - last < 33) return; // ~30fps cap
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.vy;
        if (p.y < -30) { p.y = h + 30; p.x = Math.random() * w; }
        const c = p.hue < 0.5 ? '34,211,238' : p.hue < 0.8 ? '59,130,246' : '139,92,246';
        ctx.font = `${p.size}px ui-monospace, monospace`;
        ctx.fillStyle = `rgba(${c},${p.alpha})`;
        ctx.fillText(p.ch, p.x, p.y);
      }
    };

    const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; });
    io.observe(cv);
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(draw);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="bg-grid" aria-hidden="true" />
      <canvas ref={canvas} className="bg-canvas" aria-hidden="true" />
      <div className="bg-scanlines" aria-hidden="true" />
      <div className="bg-vignette" aria-hidden="true" />
    </>
  );
}

/* ----------------------------------- BOOT --------------------------------- */

const BOOT_LINES = [
  'VR DEVELOPMENTS :: KERNEL v1.0',
  'mounting transformation registry ...',
  'loading operation modules ......... OK',
  'verifying crypto primitives ....... OK',
  'calibrating phosphor grid ......... OK',
  'local-first mode: ACTIVE (no telemetry)',
  'ACCESS GRANTED'
];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [lineCount, setLineCount] = useState(0);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    if (reducedMotion()) {
      const t = setTimeout(onDone, 350);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => timers.push(setTimeout(() => setLineCount(i + 1), 120 + i * 210)));
    timers.push(setTimeout(() => setFade(true), 120 + BOOT_LINES.length * 210 + 320));
    timers.push(setTimeout(onDone, 120 + BOOT_LINES.length * 210 + 320 + 480));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`boot ${fade ? 'boot--fade' : ''}`} onClick={onDone} role="presentation">
      <div className="boot__inner">
        <BrandMark size={72} />
        <div className="boot__logo">VR KRYPTA</div>
        <div className="boot__sub">VR DEVELOPMENTS</div>
        <div className="boot__lines">
          {BOOT_LINES.slice(0, lineCount).map((l, i) => (
            <div key={i} className="boot__line">
              <span className="boot__prompt">&gt;</span> {l}
              {i === BOOT_LINES.length - 1 && <span className="boot__ok"> ▊</span>}
            </div>
          ))}
        </div>
        <div className="boot__skip">click to skip</div>
      </div>
    </div>
  );
}
