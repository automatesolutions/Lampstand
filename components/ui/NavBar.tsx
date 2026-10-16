"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  title?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}

/**
 * 44px blurred bar (DESIGN.md §4). The hairline appears only once content
 * scrolls under it.
 */
export function NavBar({ title, back, actions }: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`glass sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-[border-color] duration-150 border-b ${
        scrolled ? "border-divider" : "border-transparent"
      }`}
    >
      <div className="mx-auto grid h-11 max-w-[680px] grid-cols-[1fr_auto_1fr] items-center px-1">
        <div className="flex items-center">
          {back && (
            <Link href={back.href} className="flex min-h-11 items-center gap-0.5 rounded-md pr-3 text-body text-gold-text">
              <Icon name="chevron-left" className="size-6" />
              {back.label}
            </Link>
          )}
        </div>
        <div className="truncate text-center text-headline">{title}</div>
        <div className="flex items-center justify-end">{actions}</div>
      </div>
    </header>
  );
}

/** Top of each tab: eyebrow above a display title (DESIGN.md §3). */
export function PageTitle({ children, eyebrow, back }: { children: ReactNode; eyebrow?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="flex flex-col gap-1.5">
      {back && (
        <Link href={back.href} className="-ml-1.5 mb-1 flex min-h-11 items-center gap-0.5 self-start rounded-md pr-3 text-body font-medium text-gold-text">
          <Icon name="chevron-left" className="size-5" />
          {back.label}
        </Link>
      )}
      {eyebrow && <p className="text-eyebrow text-text-secondary">{eyebrow}</p>}
      <h1 className="text-display">{children}</h1>
    </header>
  );
}
