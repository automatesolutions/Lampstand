"use client";

import Image from "next/image";
import { LampMark } from "@/components/brand/LampMark";
import { mascotSrc, seedOf, type MascotMessage, type Mood } from "@/lib/lamplighters/assets";

/**
 * The lamp mascot from assets/mascot, picked by mood. The art is cropped to its top
 * part so a wordmark under the character doesn't show. Decorative: the words beside
 * it carry the meaning.
 */
export function Mascot({ mood, size = 72, seed = 0, className = "" }: { mood: Mood; size?: number; seed?: number; className?: string }) {
  const src = mascotSrc(mood, seed);
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {src ? (
        <Image src={src} alt="" width={size * 2} height={size * 2} className="absolute inset-x-0 top-0 h-[136%] w-full max-w-none object-cover object-top" />
      ) : (
        <LampMark size={size} />
      )}
    </span>
  );
}

/** The mascot with a speech bubble. */
export function MascotSays({ message, size = 72, className = "" }: { message: MascotMessage; size?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-2.5 ${className}`}>
      <Mascot mood={message.mood} size={size} seed={seedOf(message.text)} />
      <p className="relative mb-2 min-w-0 flex-1 rounded-lg rounded-bl-[6px] bg-surface-raised px-4 py-3 text-subhead shadow-soft ring-1 ring-divider/60">
        {message.title && <strong className="block text-headline">{message.title}</strong>}
        {message.text}
      </p>
    </div>
  );
}
