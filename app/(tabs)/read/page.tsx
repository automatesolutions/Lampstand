"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookPicker } from "@/components/BookPicker";
import { Icon } from "@/components/ui/Icon";
import { ModK } from "@/components/ui/Kbd";
import { bookByCode } from "@/lib/bible/books";
import { KINDS, booksOfKind, kindOf } from "@/lib/bible/kinds";
import { VERSIONS } from "@/lib/bible/provider";
import { formatRef, readerHref } from "@/lib/bible/refs";
import { openPalette } from "@/lib/palette";
import { useHydrated, useStore } from "@/lib/store";

/** Spine height grows with chapter count, so Psalms stands tallest (DESIGN.md §8). */
const spineHeight = (chapters: number) => Math.round(88 + Math.sqrt(chapters) * 9);

export default function ReadPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const position = useStore((s) => s.position);
  const reads = useStore((s) => s.reads);
  const version = useStore((s) => s.prefs.version);
  const [book, setBook] = useState<string | null>(null);

  const started = useMemo(() => new Set(hydrated ? reads.map((r) => r.book) : []), [hydrated, reads]);
  const here = hydrated ? position : null;
  const hereBook = here ? bookByCode(here.book) : null;
  const hereRead = here ? new Set(reads.filter((r) => r.book === here.book).map((r) => r.chapter)).size : 0;

  return (
    <>
    {/* Go to: floats above the tab bar on phones (outside the animated column, so "fixed" means the screen). */}
    <div className="fixed inset-x-0 bottom-[calc(56px+10px+env(safe-area-inset-bottom))] z-20 px-gutter min-[960px]:hidden">
      <GoToButton />
    </div>
    <div className="arrive flex flex-col gap-7 pb-24 min-[960px]:pb-0">
      <header className="flex flex-col gap-1.5">
        <p className="text-eyebrow text-text-secondary">{VERSIONS.find((v) => v.id === version)?.name ?? "King James Version"} · 66 books</p>
        <h1 className="text-display">Read</h1>
      </header>

      <div className="hidden min-[960px]:block">
        <GoToButton />
      </div>

      {here && hereBook && (
        <Link
          href={readerHref(here.version, here, here.verse > 1 ? here.verse : undefined)}
          className="flex items-center gap-4 rounded-lg bg-surface-raised p-4 shadow-soft ring-1 ring-divider/60"
        >
          <span aria-hidden="true" className="relative h-14 w-[30px] shrink-0 rounded-[4px_6px_6px_4px] shadow-[inset_-3px_0_0_rgba(0,0,0,.14)]" style={{ background: kindOf(here.book).pigment }}>
            <span className="absolute inset-x-1 top-2 h-0.5 bg-[var(--leaf-1)]" />
            <span className="absolute inset-x-1 bottom-2 h-0.5 bg-[var(--leaf-1)]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-eyebrow text-text-secondary">Continue</span>
            <span className="block font-display text-[1.375rem] font-semibold leading-tight">{formatRef({ book: here.book, chapter: here.chapter })}</span>
            <span className="block text-footnote text-text-secondary">
              {here.verse > 1 ? `You stopped at verse ${here.verse}` : "From the start"} · {hereRead} of {hereBook.chapters} {hereBook.chapters === 1 ? "chapter" : "chapters"} read
            </span>
          </span>
          <Icon name="chevron-right" className="size-[18px] text-text-secondary" />
        </Link>
      )}

      {KINDS.map((k) => {
        const books = booksOfKind(k);
        return (
          <section key={k.id} aria-labelledby={`shelf-${k.id}`} className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`shelf-${k.id}`} className="flex items-center gap-2.5 font-display text-[1.375rem] font-semibold leading-tight">
                <span aria-hidden="true" className="size-2.5 rotate-45 rounded-[3px]" style={{ background: k.pigment }} />
                {k.name}
              </h2>
              <span className="text-footnote tabular-nums text-text-secondary">{books.length} books</span>
            </div>
            <div className="-mx-1 overflow-x-auto px-1 pt-3.5 [scrollbar-width:thin]">
              <ul className="flex w-max min-w-full items-end gap-1 border-b-[6px] border-surface px-2 shadow-[0_1px_0_var(--divider)]">
                {books.map((b) => (
                  <li key={b.code}>
                    <button
                      type="button"
                      onClick={() => setBook(b.code)}
                      aria-label={`${b.name}, ${b.chapters} ${b.chapters === 1 ? "chapter" : "chapters"}${started.has(b.code) ? ", started" : ""}`}
                      className="relative flex w-11 items-center justify-center rounded-[3px_5px_2px_2px] text-on-pigment shadow-[inset_-4px_0_0_rgba(0,0,0,.16),inset_3px_0_0_rgba(255,255,255,.12)] transition-transform duration-200 ease-out before:absolute before:inset-x-[5px] before:top-2.5 before:h-0.5 before:bg-[var(--leaf-1)] before:shadow-[0_4px_0_var(--leaf-1)] after:absolute after:inset-x-[5px] after:bottom-2.5 after:h-0.5 after:bg-[var(--leaf-1)] [@media(hover:hover)]:hover:-translate-y-1.5"
                      style={{ height: spineHeight(b.chapters), background: k.pigment }}
                    >
                      {started.has(b.code) && <span aria-hidden="true" className="absolute -top-[9px] size-1.5 rounded-full bg-gold" />}
                      <span
                        aria-hidden="true"
                        className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.8125rem] font-semibold leading-none tracking-[0.04em] [transform:rotate(180deg)] [writing-mode:vertical-rl]"
                        style={{ maxHeight: spineHeight(b.chapters) - 40 }}
                      >
                        {b.short}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

      <BookPicker
        open={book !== null}
        initialBook={book}
        onOpenChange={(o) => !o && setBook(null)}
        onSelect={(ref) => router.push(readerHref(version, ref))}
      />
    </div>
    </>
  );
}

function GoToButton() {
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      className="mx-auto flex min-h-[52px] w-full max-w-[680px] items-center gap-2.5 rounded-[16px] bg-surface-raised px-3.5 text-left text-body text-text-secondary shadow-float min-[960px]:bg-surface min-[960px]:shadow-none"
    >
      <Icon name="search" className="size-5" />
      <span className="flex-1">Go to a book or verse</span>
      <ModK />
    </button>
  );
}
