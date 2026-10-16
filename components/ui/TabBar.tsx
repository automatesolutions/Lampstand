"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LampMark } from "@/components/brand/LampMark";
import { openPalette } from "@/lib/palette";
import { Icon, type IconName } from "./Icon";
import { ModK } from "./Kbd";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Today", icon: "house", match: (p) => p === "/" || p.startsWith("/streak") || p.startsWith("/plans") },
  { href: "/read", label: "Read", icon: "book-open", match: (p) => p.startsWith("/read") },
  { href: "/notes", label: "Notes", icon: "notebook-pen", match: (p) => p.startsWith("/notes") },
  { href: "/me", label: "Me", icon: "user", match: (p) => p.startsWith("/me") },
];

/**
 * Bottom tab bar on phones (56px + safe area), side rail from 960px (DESIGN.md §5).
 * `railOnly` is for the reader, which has its own thumb bar on phones.
 */
export function TabBar({ railOnly = false }: { railOnly?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={`glass fixed z-30 ${railOnly ? "hidden min-[960px]:flex" : "flex"} inset-x-0 bottom-0 border-t border-divider pb-[env(safe-area-inset-bottom)] pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))] min-[960px]:inset-y-0 min-[960px]:left-0 min-[960px]:right-auto min-[960px]:w-[232px] min-[960px]:flex-col min-[960px]:gap-7 min-[960px]:border-r min-[960px]:border-t-0 min-[960px]:px-4 min-[960px]:py-7`}
    >
      <Link href="/" className="hidden items-center gap-2.5 rounded-md px-3 font-display text-[1.5rem] font-semibold leading-none min-[960px]:flex">
        <LampMark size={34} />
        Lampstand
      </Link>
      <button
        type="button"
        onClick={openPalette}
        className="hidden min-h-[46px] w-full items-center gap-2.5 rounded-[12px] bg-surface px-3 text-left text-subhead text-text-secondary min-[960px]:flex"
      >
        <Icon name="search" className="size-[18px]" />
        <span className="flex-1">Go to…</span>
        <ModK always />
      </button>
      <ul className="mx-auto grid h-14 w-full max-w-[680px] grid-cols-4 min-[960px]:m-0 min-[960px]:h-auto min-[960px]:grid-cols-1 min-[960px]:gap-1">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-[3px] text-[0.6875rem] font-semibold tracking-[0.02em] min-[960px]:h-[46px] min-[960px]:flex-row min-[960px]:justify-start min-[960px]:gap-3 min-[960px]:rounded-[12px] min-[960px]:px-3 min-[960px]:text-[0.95rem] min-[960px]:font-medium min-[960px]:tracking-normal ${
                  active
                    ? "text-gold-text before:absolute before:top-0 before:h-0.5 before:w-7 before:rounded-full before:bg-gold min-[960px]:bg-gold-wash min-[960px]:before:hidden"
                    : "text-text-secondary"
                }`}
              >
                <Icon name={t.icon} className="size-6" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
