"use client";

import { useMemo, useState } from "react";
import { BOOKS, bookByCode } from "@/lib/bible/books";
import { kindOf } from "@/lib/bible/kinds";
import { useHydrated, useStore } from "@/lib/store";
import type { ChapterRef } from "@/lib/bible/types";
import { Sheet } from "@/components/ui/Sheet";
import { ListGroup, ListRow } from "@/components/ui/List";
import { Button } from "@/components/ui/Button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ref: ChapterRef) => void;
  /** Open straight to this book's chapters. */
  initialBook?: string | null;
}

/** Two steps in one sheet: book, then chapter (screen 3). */
export function BookPicker({ open, onOpenChange, onSelect, initialBook = null }: Props) {
  const [book, setBook] = useState<string | null>(initialBook);
  const [lastInitial, setLastInitial] = useState(initialBook);
  if (initialBook !== lastInitial) {
    setLastInitial(initialBook);
    setBook(initialBook);
  }
  const meta = book ? bookByCode(book) : null;
  const hydrated = useHydrated();
  const reads = useStore((s) => s.reads);
  const position = useStore((s) => s.position);
  const read = useMemo(() => new Set(hydrated && book ? reads.filter((r) => r.book === book).map((r) => r.chapter) : []), [hydrated, reads, book]);
  const here = hydrated && position?.book === book ? position.chapter : null;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setBook(initialBook);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} title={meta ? meta.name : "Choose a book"} description={meta ? "Choose a chapter" : undefined}>
      {meta ? (
        <div className="flex flex-col gap-4">
          <p className="-mt-1 flex items-center gap-2 text-footnote text-text-secondary">
            <span aria-hidden="true" className="size-2.5 rotate-45 rounded-[3px]" style={{ background: kindOf(meta.code).pigment }} />
            {kindOf(meta.code).name} · {meta.chapters} {meta.chapters === 1 ? "chapter" : "chapters"} · {read.size ? `${read.size} read` : "Not started"}
          </p>
          {!initialBook && (
            <Button variant="plain" icon="chevron-left" className="-ml-2 self-start pl-0" onClick={() => setBook(null)}>
              Books
            </Button>
          )}
          <ul aria-label={`${meta.name} chapters`} className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
            {Array.from({ length: meta.chapters }, (_, i) => i + 1).map((n) => {
              const done = read.has(n);
              const isHere = here === n;
              return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ book: meta.code, chapter: n });
                    handleOpenChange(false);
                  }}
                  aria-label={`${meta.name} ${n}${done ? ", read" : ""}${isHere ? ", where you are" : ""}`}
                  className={`relative grid h-[52px] w-full place-items-center rounded-md text-headline tabular-nums active:bg-gold-wash [@media(hover:hover)]:hover:bg-gold-wash ${
                    done ? "bg-gold-wash text-gold-text after:absolute after:right-[7px] after:top-[7px] after:size-1.5 after:rounded-full after:bg-gold" : "bg-bg"
                  } ${isHere ? "outline-2 -outline-offset-2 outline-gold" : ""}`}
                >
                  {n}
                </button>
              </li>
              );
            })}
          </ul>
          <p aria-hidden="true" className="flex flex-wrap gap-4 text-footnote text-text-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded-[5px] bg-gold-wash" />Read</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded-[5px] outline-2 -outline-offset-2 outline-gold" />Where you are</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {(["OT", "NT"] as const).map((t) => (
            <ListGroup key={t} label={t === "OT" ? "Old Testament" : "New Testament"}>
              {BOOKS.filter((b) => b.testament === t).map((b) => (
                <ListRow key={b.code} title={b.name} value={<>{b.chapters}<span className="sr-only"> chapters</span></>} chevron onClick={() => setBook(b.code)} />
              ))}
            </ListGroup>
          ))}
        </div>
      )}
    </Sheet>
  );
}
