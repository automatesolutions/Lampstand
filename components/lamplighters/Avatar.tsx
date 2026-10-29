"use client";

import Image from "next/image";
import { useState } from "react";
import { LampMark } from "@/components/brand/LampMark";
import { avatarSrc } from "@/lib/lamplighters/assets";

interface Props {
  id: string | null | undefined;
  size?: number;
  /** Alt text. Leave empty when the person's name is written right beside it. */
  alt?: string;
  /** The small lit lamp for "read today" (DESIGN.md §11). */
  lit?: boolean;
  className?: string;
}

/** A Lamplighter's avatar; the lamp on gold when none is chosen or the file is gone. */
export function Avatar({ id, size = 40, alt = "", lit, className = "" }: Props) {
  const src = avatarSrc(id);
  const [broken, setBroken] = useState<string | null>(null);
  const show = src && broken !== src;
  return (
    <span className={`relative inline-grid shrink-0 ${className}`} style={{ width: size, height: size }}>
      {show ? (
        <Image src={src} alt={alt} width={size} height={size} onError={() => setBroken(src)} className="size-full rounded-full bg-surface object-cover ring-1 ring-divider" />
      ) : (
        <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className="grid size-full place-items-center rounded-full bg-gold-wash ring-1 ring-divider">
          <LampMark size={Math.round(size * 0.72)} />
        </span>
      )}
      {lit !== undefined && <ReadLamp lit={lit} className="absolute -bottom-1 -right-1" />}
    </span>
  );
}

/** The read-today lamp: lit when they've read today. Only ever says that, never what. */
export function ReadLamp({ lit, className = "" }: { lit: boolean; className?: string }) {
  return (
    <span className={`grid size-[22px] place-items-center rounded-full bg-surface-raised ring-1 ring-divider ${className}`}>
      <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden="true" className={lit ? "text-gold" : "text-text-secondary/60"}>
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round">
          <path d="M8 38c0-3.3 7.6-6 20-6h6.5c2.2 0 3.4-1 4.6-2.6L40 28l1 1.6c.8 1.4.2 3.1-1.2 3.9l-2.3 1.2c4.5 1.2 7.5 2.9 7.5 4.8 0 5.5-8.6 10.5-19 10.5S8 44.6 8 38Z" />
        </g>
        {lit && <path d="M40 4c4.6 5.2 7 9.4 7 12.9a7 7 0 0 1-14 0C33 13.4 35.4 9.2 40 4Z" fill="url(#lamp-leaf)" />}
      </svg>
    </span>
  );
}
