"use client";

import { useSyncExternalStore } from "react";

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘ K" on Apple devices, "Ctrl K" elsewhere. Server render assumes Ctrl. */
export function useModKey(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (isMac() ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

/**
 * Key cap (DESIGN.md §8 Kbd). Hidden on touch screens by default, so phones
 * stay clean; pass `always` where a hardware keyboard is certain.
 */
export function Kbd({ children, always = false, className = "" }: { children: React.ReactNode; always?: boolean; className?: string }) {
  return (
    <kbd
      className={`${always ? "inline-flex" : "hidden [@media(hover:hover)_and_(pointer:fine)]:inline-flex"} h-6 min-w-6 items-center justify-center whitespace-nowrap rounded-[6px] border border-divider bg-linear-to-b from-surface-raised to-surface px-[7px] font-sans text-[0.75rem] font-semibold leading-none text-text-secondary shadow-[0_1px_0_var(--divider)] ${className}`}
    >
      {children}
    </kbd>
  );
}

export function ModK({ always = false }: { always?: boolean }) {
  const mod = useModKey();
  return <Kbd always={always}>{mod} K</Kbd>;
}
