// The Lampstand mark: a small clay oil lamp with a flame. Custom drawings in the
// app are limited to this lamp and the fleuron (DESIGN.md §7).

/** Gradient defs shared by every lamp; rendered once in the root layout. */
export function LampDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="lamp-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--leaf-3)" />
          <stop offset=".45" stopColor="var(--leaf-1)" />
          <stop offset="1" stopColor="var(--leaf-2)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const FLAME = "M40 9c3.6 4.2 5.4 7.6 5.4 10.4a5.4 5.4 0 0 1-10.8 0C34.6 16.6 36.4 13.2 40 9Z";
const FLAME_CORE = "M40 15.5c1.5 1.9 2.2 3.3 2.2 4.4a2.2 2.2 0 0 1-4.4 0c0-1.1.7-2.5 2.2-4.4Z";

export function LampBody({ dashed = false }: { dashed?: boolean }) {
  return (
    <g fill="none" stroke="currentColor" strokeDasharray={dashed ? "3 3" : undefined}>
      <path
        d="M8 36c0-3.3 7.6-6 20-6h6.5c2.2 0 3.4-1 4.6-2.6L40 26l1 1.6c.8 1.4.2 3.1-1.2 3.9l-2.3 1.2c4.5 1.2 7.5 2.9 7.5 4.8 0 5.5-8.6 10.5-19 10.5S8 42.6 8 36Z"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      <ellipse cx="22" cy="35" rx="5" ry="1.8" strokeWidth="2" />
      <path d="M19 50.5h16" strokeWidth="2.25" strokeLinecap="round" />
    </g>
  );
}

export function LampMark({ size = 56, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="text-gold"
    >
      <circle cx="40" cy="20" r="14" fill="var(--gold)" opacity="0.12" />
      <path d={FLAME} fill="url(#lamp-leaf)" />
      <path d={FLAME_CORE} fill="var(--bg)" opacity="0.7" />
      <LampBody />
    </svg>
  );
}

interface LampProps {
  /** 0 to 1: today's progress toward the goal. */
  progress: number;
  size: number;
  label?: string;
  /** Play the kindle and bloom once (chapter done). */
  kindle?: boolean;
  className?: string;
}

/** The lamp as progress (DESIGN.md §8): flame and glow grow from an ember to full. */
export function Lamp({ progress, size, label, kindle = false, className = "" }: LampProps) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className={`relative isolate grid shrink-0 place-items-center ${kindle ? "lamp-kindle" : ""} ${className}`} style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className="lamp-glow pointer-events-none absolute -z-10 rounded-full"
        style={{
          width: size * 2.3,
          height: size * 2.3,
          top: `calc(50% - ${size * 1.15}px - ${size * 0.12}px)`,
          left: `calc(50% - ${size * 1.15}px + ${size * 0.12}px)`,
          background: "radial-gradient(circle, var(--glow) 0%, transparent 62%)",
          scale: String(0.35 + p * 0.85),
          opacity: 0.35 + p * 0.65,
        }}
      />
      <svg width={size} height={size} viewBox="0 0 64 64" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="text-gold">
        <LampBody />
        <g className="lamp-flame" style={{ scale: String(0.35 + p * 0.75) }}>
          <g className="lamp-flicker">
            <path d={FLAME} fill="url(#lamp-leaf)" />
            <path d={FLAME_CORE} fill="var(--surface)" opacity="0.75" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** A small lamp for the week strip: lit, rest day, or unlit. */
export function DayLamp({ state }: { state: "lit" | "rest" | "unlit" }) {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true" className={state === "lit" ? "text-gold" : "text-text-secondary/55"}>
      <LampBody dashed={state === "rest"} />
      {state === "lit" && <path d={FLAME} fill="url(#lamp-leaf)" />}
    </svg>
  );
}

export function Fleuron({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-3 text-gold ${className}`}>
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-divider" />
      <svg width="22" height="14" viewBox="0 0 22 14" fill="currentColor">
        <path d="M11 1c1.6 2.4 1.6 4.6 0 6-1.6-1.4-1.6-3.6 0-6zM11 13c-2-3-5.5-4-9.5-3 2.5-2 6.5-2 9.5 1 3-3 7-3 9.5-1-4-1-7.5 0-9.5 3z" />
      </svg>
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-divider" />
    </div>
  );
}
