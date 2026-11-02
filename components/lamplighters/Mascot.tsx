"use client";

import Image from "next/image";
import { useState } from "react";
import { LampMark } from "@/components/brand/LampMark";
import { mascotMessage, mascotSrc, seedOf, type MascotMessage, type Mood } from "@/lib/lamplighters/assets";

/**
 * The lamp mascot from assets/mascot, picked by mood. The art is cropped to its top
 * part so a wordmark under the character doesn't show. It says hello with a hop and a
 * wiggle, then breathes; tap it and it bounces and throws out a few stars. Decorative:
 * the words beside it carry the meaning.
 */
export function Mascot({ mood, size = 72, seed = 0, className = "", onTap }: { mood: Mood; size?: number; seed?: number; className?: string; onTap?: () => void }) {
  const src = mascotSrc(mood, seed);
  const [taps, setTaps] = useState(0);
  return (
    <span
      aria-hidden="true"
      onClick={() => (setTaps((n) => n + 1), onTap?.())}
      className={`mascot-cheer relative block shrink-0 cursor-pointer select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span key={taps} className={`absolute inset-0 ${taps ? "mascot-boing" : ""}`}>
        <span className="absolute inset-0 overflow-hidden rounded-[28%]">
          {src ? (
            <Image src={src} alt="" width={size * 2} height={size * 2} draggable={false} className="absolute inset-x-0 top-0 h-[136%] w-full max-w-none object-cover object-top" />
          ) : (
            <LampMark size={size} />
          )}
        </span>
      </span>
      {SPARKLES.map((s, i) => (
        <Star key={i} className="mascot-sparkle" style={{ left: `${s.x}%`, top: `${s.y}%`, width: size * s.size, height: size * s.size, animationDelay: `${s.delay}s` }} />
      ))}
      {taps > 0 &&
        BURST.map((b, i) => (
          <Star
            key={`${taps}.${i}`}
            className="star-burst"
            style={{ left: "50%", top: "40%", width: size * 0.16, height: size * 0.16, ["--dx" as string]: `${b.x * size}px`, ["--dy" as string]: `${b.y * size}px` }}
          />
        ))}
    </span>
  );
}

function Star({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 10 10" className={`pointer-events-none absolute fill-gold ${className}`} style={style}>
      <path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z" />
    </svg>
  );
}

/** Where the little stars twinkle around the mascot's head, as % of its box. */
const SPARKLES = [
  { x: 82, y: 2, size: 0.16, delay: 1.2 },
  { x: -6, y: 18, size: 0.12, delay: 2.1 },
  { x: 90, y: 40, size: 0.1, delay: 2.9 },
];

/** Stars thrown out on a tap: seven directions around the head, in mascot sizes. */
const BURST = Array.from({ length: 7 }, (_, i) => {
  const a = -Math.PI / 2 + ((i - 3) * Math.PI) / 5;
  return { x: Math.cos(a) * 0.75, y: Math.sin(a) * 0.65 };
});

/** The mascot with a speech bubble. Tapping the mascot gets a playful reply. */
export function MascotSays({ message, size = 72, className = "" }: { message: MascotMessage; size?: number; className?: string }) {
  const [reply, setReply] = useState<MascotMessage | null>(null);
  const shown = reply ?? message;
  return (
    <div className={`flex items-end gap-2.5 ${className}`}>
      <Mascot mood={message.mood} size={size} seed={seedOf(message.text)} onTap={() => setReply((r) => mascotMessage("tap", seedOf(r?.text ?? message.text) + 1))} />
      <p key={shown.text} className="mascot-bubble relative mb-2 min-w-0 flex-1 rounded-lg rounded-bl-[6px] bg-surface-raised px-4 py-3 text-subhead shadow-soft ring-1 ring-divider/60">
        {shown.title && <strong className="block text-headline">{shown.title}</strong>}
        {shown.text}
      </p>
    </div>
  );
}
