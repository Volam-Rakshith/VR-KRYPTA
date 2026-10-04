// Inline SVG icon system — no icon-font or network requests. All icons share
// a stroke style matching the brand's angular, terminal-like linework.
import type { JSX } from 'react';

const PATHS: Record<string, JSX.Element> = {
  bolt: <path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5L13 2Z" />,
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" />,
  star: <path d="m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.3-.9L12 3Z" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2" />,
  gear: <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5-3.5-.1-1.6-2.2-.7a6.9 6.9 0 0 0-.8-1.9l1-2.1-1.1-1.1-2.1 1a6.9 6.9 0 0 0-1.9-.8l-.7-2.2h-1.6l-.7 2.2a6.9 6.9 0 0 0-1.9.8l-2.1-1-1.1 1.1 1 2.1a6.9 6.9 0 0 0-.8 1.9l-2.2.7L3 12l.1 1.6 2.2.7c.2.7.5 1.3.8 1.9l-1 2.1 1.1 1.1 2.1-1c.6.4 1.2.7 1.9.8l.7 2.2h1.6l.7-2.2c.7-.2 1.3-.5 1.9-.8l2.1 1 1.1-1.1-1-2.1c.4-.6.7-1.2.8-1.9l2.2-.7.1-1.6Z" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13V9m0 4v5" />,
  copy: <path d="M9 9h11v11H9zM5 15V4h11" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />,
  upload: <path d="M12 15V4m0 0 4 4m-4-4L8 8M4 19h16" />,
  swap: <path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" />,
  play: <path d="M7 4.5v15l12-7.5L7 4.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 6h16M9 6V4h6v2m-8.5 2 .8 12h9.4l.8-12" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  search: <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm5.7-1.1L21 20.7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  sparkle: <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Zm7 11 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />,
  shield: <path d="M12 3 4.5 6v6c0 4.5 3 7.7 7.5 9 4.5-1.3 7.5-4.5 7.5-9V6L12 3Z" />,
  signal: <path d="M4 18h3v-4H4v4Zm6 0h3V9h-3v9Zm6 0h3V5h-3v13Z" />,
  key: <path d="M14.5 13.5a5.5 5.5 0 1 0-5.3-4.1L3 15.6V18h2.4l1-1v-2h2l3.8-3.8c.7.4 1.5.3 2.3.3ZM16 8.5" />,
  brackets: <path d="M9 4H5v16h4M15 4h4v16h-4" />,
  fingerprint: <path d="M12 3a9 9 0 0 1 9 9c0 2.5-.5 4-1 6M12 7a5 5 0 0 1 5 5c0 2.7-.6 5-1.3 7M12 11a1 1 0 0 1 1 1c0 3-.6 5.6-1.8 8M8.5 12.5c.3 3.5-.2 6-.7 8" />,
  shrink: <path d="M9 3v6H3m6 10v-6H3m12-12v6h6m-6 10v-6h6" />,
  binary: <path d="M6 4h3v7H6zM6 13h3v7H6zM15 4h3v7h-3zM15 13h3v7h-3z" />,
  type: <path d="M5 5h14M12 5v14m-3 0h6" />,
  chart: <path d="M4 20V10m5.5 10V4m5.5 16v-8m5.5 8V7" />,
  magnifier: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-4.8-4.8M8.5 10.5a2.5 2.5 0 0 1 2.5-2.5" />,
  home: <path d="m4 11 8-7 8 7v9h-5.5v-6h-5v6H4v-9Z" />,
  wand: <path d="m6 15 9 9-9-9Zm0 0L15 6l3 3-9 9-3-3Zm8-9 1.5-1.5M18 3l.9-.9M6 21l-1-1m9-13 3 3" />,
  link: <path d="M10 14a4.8 4.8 0 0 0 6.9.6l3-3a4.8 4.8 0 0 0-6.8-6.8l-1.7 1.7M14 10a4.8 4.8 0 0 0-6.9-.6l-3 3a4.8 4.8 0 0 0 6.8 6.8l1.7-1.7" />,
  arrowRight: <path d="M4 12h15m0 0-6-6m6 6-6 6" />,
  terminal: <path d="M4 5h16v14H4zM8 9l3 3-3 3m5 0h4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  history: <path d="M4 5v5h5M4.5 14a8 8 0 1 0 .7-5.5M12 8v4.5l3 2" />,
  flask: <path d="M9 3h6M10 3v6L4.5 19a1.6 1.6 0 0 0 1.4 2h12.2a1.6 1.6 0 0 0 1.4-2L14 9V3M8 15h8" />,
  gamepad: <path d="M7.5 8h9a4.5 4.5 0 0 1 4.56 5.53l-.57 2.13a2.5 2.5 0 0 1-4.36 1.02L15.5 15h-7l-1.63 1.68a2.5 2.5 0 0 1-4.36-1.02L1.94 13.53A4.5 4.5 0 0 1 6.5 8h1zm1 2.5v3M7 12h3m5-1.2h.01M17.2 12h.01" />
};

export interface IconProps {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
  filled?: boolean;
}

export function Icon({ name, size = 18, className, filled }: IconProps) {
  const path = PATHS[name as string];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  // The official logo asset. Brand colors in CSS stay token-based, but the
  // mark itself is the real PNG everywhere the brand appears.
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/logo.png`}
      width={size}
      height={size}
      alt="VR KRYPTA logo"
      className="brandmark-img"
      draggable={false}
    />
  );
}
