"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookPicker } from "@/components/BookPicker";
import { Fleuron, Lamp } from "@/components/brand/LampMark";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Kbd, ModK } from "@/components/ui/Kbd";
import { Sheet } from "@/components/ui/Sheet";
import type { Chapter, ChapterRef, VersionId } from "@/lib/bible/types";
import { formatRef, readerHref } from "@/lib/bible/refs";
import type { ChapterNote } from "@/lib/chapter-notes";
import type { ContextCard } from "@/lib/context-cards";
import { setScreenActions } from "@/lib/palette";
import { openPrayer } from "@/lib/prayer";
import {
  HIGHLIGHT_COLORS,
  markContextSeen,
  markRead,
  setPosition,
  setPrefs,
  today,
  toggleHighlight,
  useHydrated,
  useStore,
  type HighlightColor,
  type Note,
} from "@/lib/store";
import { useReadingSummary } from "@/lib/store/hooks";
import { useScrollAway } from "@/lib/use-scroll-away";
import { NoteSheet } from "./NoteSheet";
import { ReaderSettings } from "./ReaderSettings";
import { VersionSheet } from "./VersionSheet";

interface Props {
  chapter: Chapter;
  bookName: string;
  card: ContextCard | null;
  note: ChapterNote | null;
  /** The book's illuminated plate. */
  plate: string;
  prev: ChapterRef | null;
  next: ChapterRef | null;
  versionName: string;
  copyright: string;
  versionLink?: { href: string; label: string };
}

type NoteTarget = { verse: number | null; existing?: Note };

const SWATCH: Record<HighlightColor, { label: string; fill: string }> = {
  gold: { label: "Gold", fill: "var(--gold)" },
  sky: { label: "Blue", fill: "var(--pg-law)" },
  sage: { label: "Green", fill: "var(--pg-history)" },
  rose: { label: "Rose", fill: "var(--pg-gospels)" },
};
const HL_BG: Record<HighlightColor, string> = {
  gold: "color-mix(in srgb, var(--gold) 26%, transparent)",
  sky: "color-mix(in srgb, var(--pg-law) 22%, transparent)",
  sage: "color-mix(in srgb, var(--pg-history) 24%, transparent)",
  rose: "color-mix(in srgb, var(--pg-gospels) 22%, transparent)",
};

const CARD_ROWS: { key: keyof Omit<ContextCard, "status">; label: string }[] = [
  { key: "author", label: "Author" },
  { key: "date", label: "Date" },
  { key: "audience", label: "First readers" },
  { key: "setting", label: "Setting" },
  { key: "purpose", label: "Why it was written" },
];

export function Reader({ chapter, bookName, card, note, plate, prev, next, versionName, copyright, versionLink }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const ref = useMemo(() => ({ book: chapter.book, chapter: chapter.chapter }), [chapter.book, chapter.chapter]);
  const title = formatRef(ref);

  const allNotes = useStore((s) => s.notes);
  const allHighlights = useStore((s) => s.highlights);
  const reads = useStore((s) => s.reads);
  const contextSeen = useStore((s) => s.contextSeen);
  const { goal, readToday } = useReadingSummary();

  const notes = useMemo(() => allNotes.filter((n) => n.book === chapter.book && n.chapter === chapter.chapter), [allNotes, chapter.book, chapter.chapter]);
  const highlights = useMemo(() => {
    const m = new Map<number, HighlightColor>();
    for (const h of allHighlights) if (h.book === chapter.book && h.chapter === chapter.chapter) m.set(h.verseStart, h.color);
    return m;
  }, [allHighlights, chapter.book, chapter.chapter]);
  const notedVerses = useMemo(() => new Set(notes.map((n) => n.verseStart).filter((v): v is number => v != null)), [notes]);
  const chapterReadToday = hydrated && reads.some((r) => r.book === chapter.book && r.chapter === chapter.chapter && r.readOn === today());

  const [selected, setSelected] = useState<number | null>(null);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [status, setStatus] = useState("");
  const [cardOpen, setCardOpen] = useState<boolean | null>(null);
  const topVerse = useRef(1);
  const away = useScrollAway({ paused: selected != null });

  // The context card opens by itself the first time this book is opened each day, inline, never over the text.
  const cardDue = hydrated && card != null && contextSeen[chapter.book] !== today();
  // Remember it was due on this visit, so it stays open after being marked seen.
  const [openedDue, setOpenedDue] = useState(false);
  if (cardDue && !openedDue) setOpenedDue(true);
  const cardShown = cardOpen ?? openedDue;
  useEffect(() => {
    if (cardDue) markContextSeen(chapter.book);
  }, [cardDue, chapter.book]);

  // Keep the place: track the top visible verse.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-verse]"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => setPosition({ book: chapter.book, chapter: chapter.chapter, verse: topVerse.current, version: chapter.version });
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.verse));
        if (!visible.length) return;
        topVerse.current = Math.min(...visible);
        clearTimeout(timer);
        timer = setTimeout(save, 400);
      },
      { rootMargin: "-56px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    save();
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [chapter.book, chapter.chapter, chapter.version]);

  // Gold progress line under the top bar.
  const progressRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const t = textRef.current;
      const bar = progressRef.current;
      if (!t || !bar) return;
      const r = t.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (-r.top + innerHeight * 0.35) / Math.max(1, r.height - innerHeight * 0.5)));
      bar.style.width = `${p * 100}%`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const verseText = (n: number) => chapter.verses[n - 1]?.text ?? "";
  const chapterNotes = notes.filter((n) => n.verseStart == null);
  const prevHref = prev ? readerHref(chapter.version, prev) : null;
  const nextHref = next ? readerHref(chapter.version, next) : null;

  const select = useCallback((n: number | null, focus = false) => {
    setSelected(n);
    if (n != null && focus) {
      const el = document.getElementById(`v${n}`);
      el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el?.focus({ preventScroll: true });
    }
  }, []);

  // Arriving from Go to or a note link: #v16 selects that verse.
  useEffect(() => {
    const m = location.hash.match(/^#v(\d+)$/);
    const n = m ? Number(m[1]) : 0;
    if (n >= 1 && n <= chapter.verses.length) requestAnimationFrame(() => select(n, true));
  }, [chapter.verses.length, select]);

  function say(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => (s === msg ? "" : s)), 2400);
  }

  async function copyVerse(n: number) {
    try {
      await navigator.clipboard.writeText(`${verseText(n)} (${formatRef({ ...ref, verse: n })} ${chapter.version})`);
      say(`Copied ${formatRef({ ...ref, verse: n })}`);
    } catch {
      say("Copy isn't available in this browser");
    }
  }

  const finish = useCallback(() => {
    markRead(ref, chapter.version);
    setJustDone(true);
    requestAnimationFrame(() => document.getElementById("chapter-done")?.scrollIntoView({ block: "center" }));
  }, [ref, chapter.version]);

  function openNote(verse: number | null) {
    setNoteTarget({ verse, existing: notes.find((n) => n.verseStart === verse) });
  }

  // Screen actions for the Go to palette.
  useEffect(
    () =>
      setScreenActions([
        ...(chapterReadToday ? [] : [{ id: "mark", title: `Mark ${title} as read`, subtitle: "Lights your lamp", icon: "circle-check" as const, run: finish }]),
        { id: "pray-here", title: `Pray over ${title}`, subtitle: "With your recent chapters", icon: "hand-heart", run: () => openPrayer(ref) },
        { id: "note", title: `Add a note on ${title}`, subtitle: "Notes", icon: "notebook-pen", run: () => setNoteTarget({ verse: null }) },
        { id: "text", title: "Text settings", subtitle: "Size and line spacing", icon: "type", run: () => setTextOpen(true) },
        ...(next && nextHref ? [{ id: "next", title: `Next: ${formatRef(next)}`, icon: "chevron-right" as const, run: () => router.push(nextHref) }] : []),
        ...(prev && prevHref ? [{ id: "prev", title: `Previous: ${formatRef(prev)}`, icon: "chevron-left" as const, run: () => router.push(prevHref) }] : []),
      ]),
    [chapterReadToday, title, finish, next, nextHref, prev, prevHref, router, ref],
  );

  // Reader keys (DESIGN.md §5.3).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [role='dialog']") || document.querySelector("[role='dialog']")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowLeft" && prevHref) router.push(prevHref);
      else if (e.key === "ArrowRight" && nextHref) router.push(nextHref);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = selected == null ? 1 : Math.max(1, Math.min(chapter.verses.length, selected + (e.key === "ArrowDown" ? 1 : -1)));
        select(n, true);
      } else if (e.key === "Escape" && selected != null) select(null);
      else if (k === "a") {
        e.preventDefault();
        setTextOpen(true);
      } else if (selected != null && "1234".includes(k)) toggleHighlight(ref, selected, HIGHLIGHT_COLORS[Number(k) - 1]);
      else if (selected != null && k === "n") {
        e.preventDefault();
        openNote(selected);
      } else if (selected != null && k === "c") copyVerse(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe sideways on the text to change chapter (DESIGN.md §5.1).
  const touch = useRef<{ x: number; y: number } | null>(null);

  function switchVersion(id: VersionId) {
    setPrefs({ version: id });
    if (id !== chapter.version) router.push(readerHref(id, ref, topVerse.current));
  }

  const shown = Math.min(readToday, goal);
  const left = goal - shown;

  return (
    <div className="min-h-dvh bg-bg-soft">
      {/* Top bar: back, title; version and text controls on desktop. Hides while reading down. */}
      <header
        className={`glass sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-out ${away ? "max-[959px]:-translate-y-full" : ""}`}
      >
        <div className="relative mx-auto grid h-[52px] max-w-[760px] grid-cols-[1fr_auto_1fr] items-center px-2">
          <Link href="/read" className="flex min-h-11 items-center gap-0.5 justify-self-start rounded-md pr-3 text-body font-medium text-gold-text">
            <Icon name="chevron-left" className="size-5" />
            Read
          </Link>
          <span className="truncate text-headline" aria-hidden="true">
            {title}
          </span>
          <span className="hidden items-center justify-self-end min-[960px]:flex">
            <button
              type="button"
              onClick={() => setVersionOpen(true)}
              aria-label={`Version: ${chapter.version}. Change version`}
              className="min-h-11 rounded-md px-2.5 text-[0.875rem] font-semibold tracking-[0.06em] text-gold-text"
            >
              {chapter.version}
            </button>
            <button type="button" onClick={() => setTextOpen(true)} aria-label="Text settings" className="grid size-11 place-items-center rounded-full text-gold-text">
              <Icon name="type" className="size-[22px]" />
            </button>
          </span>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-divider">
            <span ref={progressRef} className="block h-full w-0 bg-linear-to-r from-[var(--leaf-2)] via-gold to-[var(--leaf-3)]" />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-gutter pb-[calc(110px+env(safe-area-inset-bottom))] min-[960px]:pb-16">
        <header className="flex flex-col items-center gap-1.5 pb-7 pt-10 text-center">
          <p className="text-eyebrow text-text-secondary">{bookName}</p>
          <h1 className="text-numeral text-gold-text">
            <span className="sr-only">{bookName}, chapter </span>
            {chapter.chapter}
          </h1>
          <Fleuron className="mt-2 w-[180px]" />
        </header>

        {(note || card) && (
          <section
            {...(note ? { "aria-labelledby": "chapter-note-title" } : { "aria-label": `About ${title}` })}
            className="mx-auto mb-8 w-full max-w-[64ch] overflow-hidden rounded-xl bg-surface-raised shadow-soft ring-1 ring-divider/60"
          >
            <Image
              src={plate}
              alt={`Illuminated painting for ${bookName}`}
              width={1200}
              height={800}
              sizes="(min-width: 760px) 680px, 100vw"
              loading="eager"
              className="aspect-[16/7] w-full bg-surface object-cover"
            />
            {note && (
              <div className="flex flex-col gap-2 px-5 pb-3 pt-4">
                <p className="text-eyebrow text-text-secondary">In this chapter</p>
                <h2 id="chapter-note-title" className="text-title">
                  {note.title}
                </h2>
                <p className="text-callout">{note.summary}</p>
                <button
                  type="button"
                  onClick={() => select(note.key, true)}
                  className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md font-medium text-gold-text"
                >
                  <Icon name="target" className="size-[18px]" />
                  Key verse {chapter.chapter}:{note.key}
                </button>
              </div>
            )}
            {card && (
              <div className={note ? "border-t border-divider" : ""}>
                <button
                  type="button"
                  aria-expanded={cardShown}
                  aria-controls="context-card"
                  onClick={() => setCardOpen(!cardShown)}
                  className="flex min-h-16 w-full items-center gap-3 px-5 py-3.5 text-left"
                >
                  <Icon name="scroll-text" className="size-[22px] text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-headline">Before you read {bookName}</span>
                    <span className="block text-footnote text-text-secondary">
                      {card.date} · {card.setting}
                    </span>
                  </span>
                  <Icon name="chevron-down" className={`size-[18px] text-text-secondary transition-[rotate] duration-200 ${cardShown ? "rotate-180" : ""}`} />
                </button>
                {cardShown && (
                  <dl id="context-card" className="grid gap-3.5 px-5 pb-4 pt-1">
                    {CARD_ROWS.map((r) => (
                      <div key={r.key}>
                        <dt className="text-caption text-text-secondary">{r.label}</dt>
                        <dd className="mt-0.5 text-callout">{card[r.key]}</dd>
                      </div>
                    ))}
                    <p className="border-t border-divider pt-3 text-footnote text-text-secondary">
                      Short background notes. Scholars and church traditions see some of this differently.
                      {(card.status === "draft" || note?.status === "draft") && " These notes are still being reviewed."}
                    </p>
                  </dl>
                )}
              </div>
            )}
          </section>
        )}

        <article
          ref={textRef}
          aria-label={`${title}, ${chapter.version}`}
          className="scripture mx-auto text-text"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
              const href = dx > 0 ? prevHref : nextHref;
              if (href) router.push(href);
            }
          }}
        >
          <p>
            {chapter.verses.map((v) => {
              // The NLT sometimes joins a verse with the one before it; that verse has no text of its own.
              if (!v.text) return null;
              const isSelected = selected === v.number;
              const hl = highlights.get(v.number);
              const noted = notedVerses.has(v.number);
              return (
                <span
                  key={v.number}
                  id={`v${v.number}`}
                  data-verse={v.number}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Verse ${v.number}${hl ? `, ${SWATCH[hl].label.toLowerCase()} highlight` : ""}${noted ? ", has a note" : ""}`}
                  onClick={() => select(isSelected ? null : v.number)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(isSelected ? null : v.number);
                    }
                  }}
                  style={hl ? { background: HL_BG[hl] } : undefined}
                  className={`scroll-mt-24 cursor-pointer rounded-[4px] py-px transition-colors duration-150 [box-decoration-break:clone] ${
                    isSelected ? (hl ? "outline-2 outline-offset-1 outline-gold" : "bg-gold-wash") : hl ? "" : "[@media(hover:hover)]:hover:bg-gold-wash/55"
                  }`}
                >
                  {v.number === 1 ? (
                    <>
                      <span aria-hidden="true" className="dropcap leaf-text">
                        {v.text[0]}
                      </span>
                      <span className="sr-only">{v.text[0]}</span>
                      {v.text.slice(1)}
                    </>
                  ) : (
                    <>
                      <sup aria-hidden="true" className="relative -top-[0.35em] mr-[0.25em] align-baseline font-sans text-[0.72em] font-medium text-text-secondary">
                        {v.number}
                      </sup>
                      {v.text}
                    </>
                  )}
                  {noted && <span aria-hidden="true" className="ml-1 inline-block size-[7px] -translate-y-[0.2em] rounded-full bg-gold align-middle" />}{" "}
                </span>
              );
            })}
          </p>
        </article>

        <section aria-label="Finish chapter" className="mx-auto mt-12 flex w-full max-w-[64ch] flex-col gap-3.5">
          {hydrated && chapterReadToday ? (
            <div id="chapter-done" role="status" className={`relative isolate flex flex-col items-center gap-3.5 overflow-hidden rounded-xl bg-surface px-5 py-7 text-center ${justDone ? "arrive" : ""}`}>
              <Lamp progress={1} size={104} kindle={justDone} />
              <div>
                <p className="text-title">{title} is read</p>
                <p className="mt-1.5 text-subhead text-text-secondary">
                  {shown} of {goal} today. {left > 0 ? "Your lamp is brighter." : "Today's reading is done."}
                </p>
              </div>
              <div className="grid w-full grid-cols-2 gap-2.5">
                <Button onClick={() => openNote(null)} icon="notebook-pen">
                  {chapterNotes.length ? "Edit note" : "Add a note"}
                </Button>
                {next && nextHref ? (
                  <ButtonLink href={nextHref} variant={left > 0 ? "primary" : "secondary"}>
                    {formatRef(next)}
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/">Today</ButtonLink>
                )}
              </div>
              <Button variant="plain" icon="hand-heart" onClick={() => openPrayer(ref)} className="-mb-2 w-full">
                Pray over what you read
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="large" onClick={finish}>
              Mark {title} as read
            </Button>
          )}

          {chapterNotes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {chapterNotes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => setNoteTarget({ verse: null, existing: n })} className="w-full rounded-lg bg-surface-raised p-4 text-left shadow-soft ring-1 ring-divider/60">
                    <span className="block text-footnote font-semibold text-gold-text">Note on {title}</span>
                    <span className="mt-1 line-clamp-3 block text-body">{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <nav aria-label="Chapters" className="mt-2 grid grid-cols-2 gap-2.5">
            {prev && prevHref ? (
              <ButtonLink href={prevHref} variant="plain" icon="chevron-left" className="justify-start font-medium">
                <span className="sr-only">Previous chapter: </span>
                {formatRef(prev)}
              </ButtonLink>
            ) : (
              <span />
            )}
            {next && nextHref && (
              <ButtonLink href={nextHref} variant="plain" className="justify-end font-medium">
                <span className="sr-only">Next chapter: </span>
                {formatRef(next)}
                <Icon name="chevron-right" />
              </ButtonLink>
            )}
          </nav>
          <p className="mt-5 text-center text-footnote text-text-secondary">
            {versionName}. {copyright}
            {versionLink && (
              <>
                {" "}
                <a href={versionLink.href} target="_blank" rel="noopener noreferrer" className="font-medium text-gold-text underline underline-offset-2">
                  {versionLink.label}
                </a>
              </>
            )}
          </p>
          <p aria-hidden="true" className="hidden flex-wrap items-center justify-center gap-1.5 text-center text-footnote text-text-secondary [@media(hover:hover)_and_(pointer:fine)]:flex">
            <ModK /> go to · <Kbd>←</Kbd> <Kbd>→</Kbd> chapter · <Kbd>↑</Kbd> <Kbd>↓</Kbd> verse · <Kbd>1</Kbd>–<Kbd>4</Kbd> highlight · <Kbd>A</Kbd> text
          </p>
        </section>
      </main>

      {/* Thumb bar (phones): the reader's controls where the thumb rests (DESIGN.md §5.1). */}
      <nav
        aria-label="Reader"
        className={`glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-[56px_56px_1fr_56px_56px] items-center gap-0.5 border-t border-divider pb-[calc(6px+env(safe-area-inset-bottom))] pl-[max(10px,env(safe-area-inset-left))] pr-[max(10px,env(safe-area-inset-right))] pt-1.5 transition-transform duration-300 ease-out min-[960px]:hidden ${
          away ? "translate-y-full" : ""
        }`}
      >
        <ThumbLink href="/" label="Today" icon="house" />
        <ThumbLink href={prevHref} label={prev ? `Previous chapter: ${formatRef(prev)}` : "No previous chapter"} icon="chevron-left" />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Now reading ${title}. Choose a chapter`}
          className="flex h-[52px] min-w-0 items-center justify-center gap-1.5 rounded-md bg-surface px-2 text-headline"
        >
          <span className="truncate">{title}</span>
          <Icon name="chevron-down" className="size-4 text-text-secondary" />
        </button>
        <button type="button" onClick={() => setTextOpen(true)} aria-label="Text settings" className="grid h-[52px] place-items-center rounded-md text-gold-text">
          <Icon name="type" className="size-6" />
        </button>
        <ThumbLink href={nextHref} label={next ? `Next chapter: ${formatRef(next)}` : "No next chapter"} icon="chevron-right" />
      </nav>

      {/* Verse bar: docked low, above the thumb bar (DESIGN.md §8). */}
      <div
        role="toolbar"
        aria-label={selected != null ? `Actions for ${formatRef({ ...ref, verse: selected })}` : "Verse actions"}
        aria-hidden={selected == null}
        inert={selected == null}
        className={`fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-[35] flex w-[min(520px,calc(100%-32px))] -translate-x-1/2 flex-col gap-2.5 rounded-[22px] bg-surface-raised p-3 shadow-float transition-[translate,opacity] duration-300 ease-out min-[960px]:bottom-6 min-[960px]:ml-[116px] ${
          selected == null ? "pointer-events-none translate-y-[140%] opacity-0" : ""
        }`}
      >
        {selected != null && (
          <>
            <div className="flex items-center justify-between gap-2 pl-2 pr-1">
              <span className="text-headline">{formatRef({ ...ref, verse: selected })}</span>
              <button type="button" onClick={() => select(null)} aria-label="Close" className="grid size-11 place-items-center rounded-full text-text-secondary">
                <Icon name="x" className="size-[22px]" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {HIGHLIGHT_COLORS.map((c, i) => {
                const on = highlights.get(selected) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${SWATCH[c].label} highlight`}
                    title={`${SWATCH[c].label} highlight (${i + 1})`}
                    onClick={() => toggleHighlight(ref, selected, c)}
                    className="grid size-11 place-items-center rounded-full"
                  >
                    <span className={`grid size-[26px] place-items-center rounded-full ${on ? "outline-2 outline-offset-2 outline-text" : ""}`} style={{ background: SWATCH[c].fill }}>
                      {on && <Icon name="check" className="size-3.5 text-surface-raised" />}
                    </span>
                  </button>
                );
              })}
              <span aria-hidden="true" className="mx-1 h-7 w-px bg-divider" />
              <button type="button" onClick={() => openNote(selected)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text">
                <Icon name="notebook-pen" />
                {notedVerses.has(selected) ? "Edit note" : "Note"}
                <Kbd>N</Kbd>
              </button>
              <button type="button" onClick={() => copyVerse(selected)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text">
                <Icon name="copy" />
                Copy
                <Kbd>C</Kbd>
              </button>
            </div>
          </>
        )}
      </div>

      <p role="status" aria-live="polite" className={`fixed left-1/2 top-[calc(64px+env(safe-area-inset-top))] z-50 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-subhead font-medium text-bg transition-opacity duration-200 min-[960px]:ml-[116px] ${status ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {status}
      </p>

      {noteTarget && (
        <NoteSheet
          open
          onOpenChange={(o) => {
            if (!o) setNoteTarget(null);
          }}
          target={{
            book: chapter.book,
            chapter: chapter.chapter,
            verse: noteTarget.verse,
            label: formatRef({ ...ref, verse: noteTarget.verse ?? undefined }),
            quote: noteTarget.verse != null ? verseText(noteTarget.verse) : undefined,
          }}
          existing={noteTarget.existing}
        />
      )}
      <Sheet open={textOpen} onOpenChange={setTextOpen} title="Text" description="Text size, line spacing, font and theme">
        <ReaderSettings preview version={chapter.version} onVersionChange={switchVersion} />
      </Sheet>
      <VersionSheet open={versionOpen} onOpenChange={setVersionOpen} current={chapter.version} onSelect={switchVersion} />
      <BookPicker
        open={pickerOpen}
        initialBook={chapter.book}
        onOpenChange={setPickerOpen}
        onSelect={(r) => router.push(readerHref(chapter.version, r))}
      />
    </div>
  );
}

function ThumbLink({ href, label, icon }: { href: string | null; label: string; icon: "house" | "chevron-left" | "chevron-right" }) {
  if (!href)
    return (
      <span aria-hidden="true" className="grid h-[52px] place-items-center text-text-tertiary">
        <Icon name={icon} className="size-6" />
      </span>
    );
  return (
    <Link href={href} aria-label={label} className="grid h-[52px] place-items-center rounded-md text-gold-text">
      <Icon name={icon} className="size-6" />
    </Link>
  );
}
