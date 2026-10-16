"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { kindOf } from "@/lib/bible/kinds";
import { parseRef } from "@/lib/bible/parse";
import { formatRef, readerHref } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { onOpenPalette, useScreenActions, type PaletteAction } from "@/lib/palette";
import { openPrayer } from "@/lib/prayer";
import { setPrefs, useStore } from "@/lib/store";
import { useReadingSummary } from "@/lib/store/hooks";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  icon?: IconName;
  pigment?: string;
  run: () => void;
}

/**
 * Go to (DESIGN.md §5.3): one box for books, verses, notes and actions.
 * Opens with ⌘K / Ctrl K, "/", or openPalette().
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const notes = useStore((s) => s.notes);
  const reads = useStore((s) => s.reads);
  const position = useStore((s) => s.position);
  const prefs = useStore((s) => s.prefs);
  const screen = useScreenActions();
  const { next } = useReadingSummary();

  useEffect(() => onOpenPalette(() => setOpen(true)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = t?.closest("input, textarea, [contenteditable='true']");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !document.querySelector("[role='dialog']")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (ref: ChapterRef, verse?: number) => router.push(readerHref(prefs.version, ref, verse));

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dark = prefs.theme === "dark" || (prefs.theme === "system" && typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
    const actions: PaletteAction[] = [
      ...screen,
      { id: "continue", title: "Continue reading", subtitle: formatRef(next), icon: "book-open", run: () => go(next) },
      { id: "pray", title: "Pray over what you read", subtitle: "A prayer from your recent chapters", icon: "hand-heart", run: () => openPrayer() },
      { id: "theme", title: dark ? "Switch to Day" : "Switch to Night", subtitle: "Appearance", icon: dark ? "sun" : "moon", run: () => setPrefs({ theme: dark ? "light" : "dark" }) },
      { id: "notes", title: "Open Notes", subtitle: `${notes.length} ${notes.length === 1 ? "note" : "notes"}`, icon: "notebook-pen", run: () => router.push("/notes") },
      { id: "goal", title: "Change daily goal", subtitle: "Me", icon: "target", run: () => router.push("/me") },
      { id: "plans", title: "Reading plans", subtitle: "Read with a set path", icon: "calendar", run: () => router.push("/plans") },
    ];
    const out: [string, Item[]][] = [];

    if (!q) {
      const recent: ChapterRef[] = [];
      const add = (r: ChapterRef) => {
        if (!recent.some((x) => x.book === r.book && x.chapter === r.chapter)) recent.push({ book: r.book, chapter: r.chapter });
      };
      if (position) add(position);
      [...reads].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).forEach(add);
      const items = recent.slice(0, 3).map((r, i) => ({
        id: `recent-${r.book}-${r.chapter}`,
        title: formatRef(r),
        subtitle: i === 0 && position ? "Where you stopped" : kindOf(r.book).name,
        pigment: kindOf(r.book).pigment,
        run: () => go(r),
      }));
      if (items.length) out.push(["Recent", items]);
      out.push(["Actions", actions]);
      return out;
    }

    const refs = parseRef(q).map(({ book, chapter, verse }) => ({
      id: `ref-${book.code}-${chapter}-${verse}`,
      title: `${book.name}${chapter ? ` ${chapter}` : ""}${verse ? `:${verse}` : ""}`,
      subtitle: chapter ? kindOf(book.code).name : `${kindOf(book.code).name} · ${book.chapters} ${book.chapters === 1 ? "chapter" : "chapters"}`,
      pigment: kindOf(book.code).pigment,
      run: () => go({ book: book.code, chapter: chapter ?? 1 }, verse ?? undefined),
    }));
    if (refs.length) out.push(["Go to", refs]);

    const noteHits = notes
      .filter((n) => `${formatRef({ book: n.book, chapter: n.chapter })} ${n.body}`.toLowerCase().includes(q))
      .slice(0, 4)
      .map((n) => ({
        id: `note-${n.id}`,
        title: formatRef({ book: n.book, chapter: n.chapter, verse: n.verseStart ?? undefined }),
        subtitle: n.body,
        icon: "notebook-pen" as const,
        run: () => go(n, n.verseStart ?? undefined),
      }));
    if (noteHits.length) out.push(["Notes", noteHits]);

    const actHits = actions.filter((a) => a.title.toLowerCase().includes(q));
    if (actHits.length) out.push(["Actions", actHits]);
    return out;
    // `go` only depends on router and version, both covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, notes, reads, position, prefs.theme, prefs.version, screen, next, router]);

  const items = groups.flatMap(([, g]) => g);
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  function run(i: number) {
    const it = items[i];
    if (!it) return;
    setOpen(false);
    it.run();
  }

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  let index = -1;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim data-[state=open]:animate-[fade-in_250ms_var(--ease-calm)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-xl bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-float outline-none data-[state=open]:animate-[arrive_300ms_var(--ease-out)] sm:bottom-auto sm:top-[12vh] sm:rounded-xl sm:pb-0"
        >
          <Dialog.Title className="sr-only">Go to</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-divider pl-[18px] pr-2">
            <Icon name="search" className="size-[22px] text-gold" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items.length ? `${listId}-${activeIndex}` : undefined}
              aria-label="Go to a book, verse, note or action"
              enterKeyHint="go"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!items.length) return;
                  const d = e.key === "ArrowDown" ? 1 : -1;
                  setActive((activeIndex + d + items.length) % items.length);
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  run(activeIndex);
                }
              }}
              placeholder="John 3:16, Ps 23, a note, or an action"
              className="h-[60px] min-w-0 flex-1 bg-transparent text-[1.1875rem] text-text outline-none placeholder:text-text-secondary"
            />
            <Dialog.Close className="grid size-11 place-items-center rounded-full text-text-secondary" aria-label="Close">
              <Icon name="x" className="size-[22px]" />
            </Dialog.Close>
          </div>

          <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {groups.length === 0 && (
              <p className="px-3 py-5 text-subhead text-text-secondary">
                Nothing matches “{query.trim()}”. Try a book and chapter, like Rom 8 or Ps 23.
              </p>
            )}
            {groups.map(([name, group]) => (
              <div key={name} role="group" aria-label={name}>
                <p aria-hidden="true" className="px-3 pb-1.5 pt-2.5 text-eyebrow text-text-secondary">
                  {name}
                </p>
                {group.map((it) => {
                  index++;
                  const i = index;
                  const selected = i === activeIndex;
                  return (
                    <div
                      key={it.id}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onClick={() => run(i)}
                      onPointerMove={() => active !== i && setActive(i)}
                      className={`grid min-h-[52px] cursor-pointer grid-cols-[32px_1fr_auto] items-center gap-3 rounded-[12px] px-3 py-1.5 ${selected ? "bg-gold-wash" : ""}`}
                    >
                      {it.pigment ? (
                        <span aria-hidden="true" className="size-3 justify-self-center rotate-45 rounded-[3px]" style={{ background: it.pigment }} />
                      ) : (
                        <Icon name={it.icon ?? "search"} className="size-5 justify-self-center text-gold-text" />
                      )}
                      <span className="min-w-0">
                        <span className="block text-headline">{it.title}</span>
                        {it.subtitle && <span className="block truncate text-footnote text-text-secondary">{it.subtitle}</span>}
                      </span>
                      <span aria-hidden="true" className={selected ? "" : "invisible"}>
                        <Kbd>↵</Kbd>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="hidden justify-end gap-4 border-t border-divider px-[18px] py-2.5 text-footnote text-text-secondary [@media(hover:hover)_and_(pointer:fine)]:flex">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
