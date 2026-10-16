"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/NavBar";
import { Icon } from "@/components/ui/Icon";
import { BOOKS, bookIndex } from "@/lib/bible/books";
import { formatRef, readerHref } from "@/lib/bible/refs";
import { useHydrated, useStore } from "@/lib/store";

export default function NotesPage() {
  const hydrated = useHydrated();
  const notes = useStore((s) => s.notes);
  const version = useStore((s) => s.prefs.version);
  const [query, setQuery] = useState("");
  const searchId = useId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = notes.filter(
      (n) => !q || n.body.toLowerCase().includes(q) || formatRef({ book: n.book, chapter: n.chapter }).toLowerCase().includes(q),
    );
    matches.sort(
      (a, b) =>
        bookIndex(a.book) - bookIndex(b.book) || a.chapter - b.chapter || (a.verseStart ?? 0) - (b.verseStart ?? 0),
    );
    const out = new Map<string, typeof matches>();
    for (const n of matches) out.set(n.book, [...(out.get(n.book) ?? []), n]);
    return [...out.entries()];
  }, [notes, query]);

  return (
    <div className="arrive flex flex-col gap-6">
      <PageTitle eyebrow={hydrated ? `${notes.length} ${notes.length === 1 ? "note" : "notes"}` : "Notes"}>Notes</PageTitle>

      {hydrated && notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-12 text-center">
          <Icon name="notebook-pen" className="size-8 text-gold" />
          <h2 className="text-headline">No notes yet</h2>
          <p className="max-w-[32ch] text-subhead text-text-secondary">Tap a verse while you read to add a note.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              Search notes
            </label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-secondary" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              className="h-12 w-full rounded-md bg-surface pl-10 pr-4 text-[17px] placeholder:text-text-secondary"
            />
          </div>

          {groups.length === 0 && hydrated && (
            <p className="py-8 text-center text-subhead text-text-secondary">No notes match “{query.trim()}”.</p>
          )}

          {groups.map(([book, items]) => (
            <section key={book} className="flex flex-col gap-2">
              <h2 className="px-1 text-eyebrow text-text-secondary">{BOOKS[bookIndex(book)]?.name}</h2>
              <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
                {items.map((n) => (
                  <li key={n.id} className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                    <Link
                      href={readerHref(version, n, n.verseStart ?? undefined)}
                      className="flex min-h-14 flex-col gap-1.5 px-[18px] py-4 active:bg-gold-wash [@media(hover:hover)]:hover:bg-gold-wash/60"
                    >
                      <span className="text-subhead font-semibold text-gold-text">
                        {formatRef({ book: n.book, chapter: n.chapter, verse: n.verseStart ?? undefined })}
                      </span>
                      <span className="line-clamp-3 text-body">{n.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
