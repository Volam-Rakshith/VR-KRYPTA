// Ambient FX layers: custom cursor, particle grid background, boot sequence.
// Everything respects prefers-reduced-motion and the user's FX toggle, is
// pointer-fine only, and never blocks interaction (pointer-events: none).
import { useEffect, useRef, useState } from 'react';
import { getPrefs } from '../services/store';

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
    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY; };
    const tick = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      if (dot.current) dot.current.style.transform = `translate(${x}px, ${y}px)`;
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(tick);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const hot = !!t.closest('a, button, [role="button"], input, textarea, select, .op-card, .pipeline-step');
      ring.current?.classList.toggle('cursor-hot', hot);
      dot.current?.classList.toggle('cursor-hot', hot);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onOver, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      document.body.classList.remove('has-cursorfx');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
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
