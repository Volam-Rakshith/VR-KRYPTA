// Ambient FX layers: custom cursor, particle grid background, boot sequence.
// Everything respects prefers-reduced-motion and the user's FX toggle, is
// pointer-fine only, and never blocks interaction (pointer-events: none).
import { useEffect, useRef, useState } from 'react';
import { getPrefs } from '../services/store';
import { Icon, BrandMark } from './icons';

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
      <div className="bg-aurora bg-aurora--a" aria-hidden="true" />
      <div className="bg-aurora bg-aurora--b" aria-hidden="true" />
      <div className="bg-watermark" aria-hidden="true">
        <span>
          {'VR KRYPTA ✦ VR DEVELOPMENTS ✦ TRANSFORM ✦ DECIPHER ✦ ANALYZE ✦ '.repeat(14)}
        </span>
        <span aria-hidden="true">
          {'VR KRYPTA ✦ VR DEVELOPMENTS ✦ TRANSFORM ✦ DECIPHER ✦ ANALYZE ✦ '.repeat(14)}
        </span>
      </div>
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

/* ---------------------------------------------------------------------------
   SCRAMBLE BUTTON — hover decodes the label through cipher noise.
   Ported dependency-free from the "encrypt button" interaction: random
   glyph noise resolves left→right, with a sweeping gradient scan band.
--------------------------------------------------------------------------- */
const SCRAMBLE_POOL = '!@#$%^&*ΨΦΔΞΩ§†‡≡¤<>/|\\{}[]()';

function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const fn = () => setPrm(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return prm;
}

interface ScrambleButtonProps {
  label: string;
  icon?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}

export function ScrambleButton({ label, icon, className, onClick, disabled, type = 'button', title }: ScrambleButtonProps) {
  const [text, setText] = useState(label);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => setText(label), [label]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setText(label);
  };

  const start = () => {
    if (reduced || timerRef.current) return;
    let pos = 0;
    const cycles = 2;
    timerRef.current = setInterval(() => {
      pos++;
      const out = label
        .split('')
        .map((ch, i) => (pos / cycles > i ? ch : ch === ' ' ? ' ' : SCRAMBLE_POOL[(Math.random() * SCRAMBLE_POOL.length) | 0]))
        .join('');
      setText(out);
      if (pos >= label.length * cycles) stop();
    }, 26);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      className={`btn btn--scramble ${className ?? ''}`}
      onClick={onClick}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
    >
      {icon && <Icon name={icon} size={15} />}
      <span className="btn__scramble-text" aria-label={label}>{text}</span>
    </button>
  );
}

/* ---------------------------------------------------------------------------
   TILT 3D — pointer-tracked perspective card with layered depth.
   Children can opt into depth planes with the attribute data-z="<px>".
--------------------------------------------------------------------------- */
export function Tilt3D({ children, className, max = 14 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div className={`tilt3d-scene ${className ?? ''}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={ref} className="tilt3d-card" style={{ transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------------------
   VELOCITY MARQUEE — endlessly drifting strip that SKEWS with scroll speed.
   Constant drift via rAF offset; skew spring-lerps toward scroll velocity.
--------------------------------------------------------------------------- */
export function VelocityMarquee({ text }: { text: string }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let x = 0;
    let lastY = window.scrollY;
    let skew = 0;
    let vel = 0;
    const tick = () => {
      const y = window.scrollY;
      const d = y - lastY;
      lastY = y;
      // springs: velocity + skew chase scroll, settle back to 0 when calm
      vel += (Math.min(10, Math.abs(d) * 0.55) - vel) * 0.1;
      const skewTarget = Math.max(-30, Math.min(30, d * 2.0));
      skew += (skewTarget - skew) * (Math.abs(skewTarget) > Math.abs(skew) ? 0.18 : 0.07);
      x -= 0.7 + vel;
      const track = trackRef.current;
      if (track) {
        const half = track.scrollWidth / 2;
        if (half > 0 && -x >= half) x += half;
        track.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, text]);

  const chunk = (key: string) => (
    <span key={key} className="vmarquee__chunk" aria-hidden={key === 'b'}>
      {text}&nbsp;&nbsp;{text}&nbsp;&nbsp;
    </span>
  );

  return (
    <div className={`vmarquee ${reduced ? 'vmarquee--static' : ''}`} aria-label={text}>
      <div ref={trackRef} className="vmarquee__track">
        {[chunk('a'), chunk('b')]}
      </div>
    </div>
  );
}
