"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { PageTitle } from "@/components/ui/NavBar";
import { Icon } from "@/components/ui/Icon";
import { BOOKS, bookIndex } from "@/lib/bible/books";
import { formatRef, readerHref } from "@/lib/bible/refs";
import { MAX_BATCH_VERSES, MAX_RANGE_VERSES, rangeKey, shownRange, type VerseRange } from "@/lib/bible/verse-batch";
import { MAX_SUMMARY_VERSES } from "@/lib/highlights/ranges";
import { useHydrated, useStore, type HighlightColor } from "@/lib/store";

// Same pigments and names as the reader's highlight swatches (DESIGN.md §2).
const SWATCH: Record<HighlightColor, { label: string; fill: string }> = {
  gold: { label: "Gold", fill: "var(--gold)" },
  sky: { label: "Blue", fill: "var(--pg-law)" },
  sage: { label: "Green", fill: "var(--pg-history)" },
  rose: { label: "Rose", fill: "var(--pg-gospels)" },
};

// Highlighted verse text, KJV (public domain), all fetched together from /api/verse/batch
// and kept for this visit. 100 ranges a request (the route's cap is 1,000 verses, 10 a
// range), so most pages need one request.
const PER_REQUEST = MAX_BATCH_VERSES / MAX_RANGE_VERSES;
const verseTexts = new Map<string, string | null>(); // range key -> text (null: no such verses)

async function fetchTexts(ranges: VerseRange[]) {
  for (let i = 0; i < ranges.length; i += PER_REQUEST) {
    const res = await fetch("/api/verse/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ranges: ranges.slice(i, i + PER_REQUEST) }),
    });
    if (!res.ok) return; // offline or refused: try again next time
    const { texts } = (await res.json()) as { texts: Record<string, string | null> };
    for (const [k, v] of Object.entries(texts)) verseTexts.set(k, v);
  }
}

/** The KJV words of each highlight; missing ones are fetched in one go. */
function useHighlightTexts(highlights: VerseRange[]) {
  const [, setVersion] = useState(0);
  const missing = useMemo(() => {
    const seen = new Map<string, VerseRange>();
    for (const h of highlights) {
      const r = shownRange(h);
      if (!verseTexts.has(rangeKey(r))) seen.set(rangeKey(r), r);
    }
    return [...seen.values()];
  }, [highlights]);
  const missingKey = missing.map(rangeKey).join(",");
  useEffect(() => {
    if (!missing.length) return;
    let live = true;
    fetchTexts(missing)
      .catch(() => {})
      .then(() => live && setVersion((v) => v + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the set of missing ranges changes
  }, [missingKey]);
  return (h: VerseRange) => verseTexts.get(rangeKey(shownRange(h))) ?? null;
}

/** The words of a highlighted verse (or range), so the row shows what was highlighted. Nothing when offline. */
function HighlightedText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span className="font-scripture text-[1.0625rem] leading-[1.6] text-text">
      &ldquo;{text}&rdquo; <span className="font-sans text-footnote text-text-secondary">KJV</span>
    </span>
  );
}

const byBook = <T extends { book: string }>(items: T[]) => {
  const out = new Map<string, T[]>();
  for (const n of items) out.set(n.book, [...(out.get(n.book) ?? []), n]);
  return [...out.entries()];
};

export default function NotesPage() {
  const hydrated = useHydrated();
  const notes = useStore((s) => s.notes);
  const highlights = useStore((s) => s.highlights);
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
    return byBook(matches);
  }, [notes, query]);

  const highlightGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = highlights.filter(
      (h) =>
        !q ||
        (h.summary ?? "").toLowerCase().includes(q) ||
        formatRef({ book: h.book, chapter: h.chapter, verse: h.verseStart, verseEnd: h.verseEnd }).toLowerCase().includes(q),
    );
    matches.sort((a, b) => bookIndex(a.book) - bookIndex(b.book) || a.chapter - b.chapter || a.verseStart - b.verseStart);
    return byBook(matches);
  }, [highlights, query]);
  const textOf = useHighlightTexts(highlights);
  const empty = notes.length === 0 && highlights.length === 0;
  const both = notes.length > 0 && highlights.length > 0;

  return (
    <div className="arrive flex flex-col gap-6">
      <PageTitle
        eyebrow={
          hydrated
            ? [`${notes.length} ${notes.length === 1 ? "note" : "notes"}`, ...(highlights.length ? [`${highlights.length} ${highlights.length === 1 ? "highlight" : "highlights"}`] : [])].join(" · ")
            : "Notes"
        }
      >
        Notes
      </PageTitle>

      {hydrated && empty ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-12 text-center">
          <Icon name="notebook-pen" className="size-8 text-gold" />
          <h2 className="text-headline">No notes yet</h2>
          <p className="max-w-[32ch] text-subhead text-text-secondary">Tap a verse while you read to add a note or a highlight.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <label htmlFor={searchId} className="sr-only">
              {highlights.length ? "Search notes and highlights" : "Search notes"}
            </label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-secondary" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={highlights.length ? "Search notes and highlights" : "Search notes"}
              className="h-12 w-full rounded-md bg-surface pl-10 pr-4 text-[17px] placeholder:text-text-secondary"
            />
          </div>

          {groups.length === 0 && highlightGroups.length === 0 && hydrated && (
            <p className="py-8 text-center text-subhead text-text-secondary">Nothing matches “{query.trim()}”.</p>
          )}

          {both && groups.length > 0 && <h2 className="-mb-3 px-1 text-title-2">Notes</h2>}
          {groups.map(([book, items]) => (
            <section key={book} className="flex flex-col gap-2">
              <h3 className="px-1 text-eyebrow text-text-secondary">{BOOKS[bookIndex(book)]?.name}</h3>
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

          {highlightGroups.length > 0 && (
            <h2 id="highlights" className="-mb-3 scroll-mt-6 px-1 text-title-2">
              Highlights
            </h2>
          )}
          {highlightGroups.map(([book, items]) => (
            <section key={`h-${book}`} className="flex flex-col gap-2">
              <h3 className="px-1 text-eyebrow text-text-secondary">{BOOKS[bookIndex(book)]?.name}</h3>
              <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
                {items.map((h) => {
                  const ref = formatRef({ book: h.book, chapter: h.chapter, verse: h.verseStart, verseEnd: h.verseEnd });
                  return (
                    <li key={h.id} className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                      <Link
                        href={readerHref(version, h, h.verseStart, h.verseEnd)}
                        className="flex min-h-14 gap-3 px-[18px] py-4 active:bg-gold-wash [@media(hover:hover)]:hover:bg-gold-wash/60"
                      >
                        <span aria-hidden="true" className="mt-1 size-3.5 shrink-0 rounded-full ring-1 ring-divider" style={{ background: SWATCH[h.color].fill }} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-subhead font-semibold text-gold-text">
                            {ref}
                            <span className="sr-only">, {SWATCH[h.color].label.toLowerCase()} highlight</span>
                          </span>
                          <HighlightedText text={textOf(h)} />
                          {h.verseEnd - h.verseStart >= MAX_RANGE_VERSES && textOf(h) && (
                            <span className="text-footnote text-text-secondary">The first {MAX_RANGE_VERSES} verses are shown here.</span>
                          )}
                          {h.verseEnd - h.verseStart >= MAX_SUMMARY_VERSES && !h.summary ? (
                            <span className="text-subhead text-text-secondary">Summaries are written for highlights of up to {MAX_SUMMARY_VERSES} verses.</span>
                          ) : h.summary ? (
                            <>
                              <span className="border-l-2 border-divider pl-3 text-callout">{h.summary}</span>
                              <span className="text-footnote text-text-secondary">Summary written by AI to help you remember {h.verseEnd > h.verseStart ? "these verses" : "this verse"}.</span>
                            </>
                          ) : (
                            <span className="text-subhead text-text-secondary">A short summary to help you remember {h.verseEnd > h.verseStart ? "these verses" : "this verse"} will appear here.</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
