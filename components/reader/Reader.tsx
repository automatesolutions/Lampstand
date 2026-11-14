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
import { finishChapter } from "@/lib/lamplighters/celebrate";
import { setScreenActions } from "@/lib/palette";
import { openExplain } from "@/lib/explain";
import { openPrayer } from "@/lib/prayer";
import { openSong } from "@/lib/song";
import { SWATCH } from "@/lib/highlights/colors";
import { colorOf, type Span } from "@/lib/highlights/ranges";
import { shiftSpans, speakerSegments, type SpeakerSpan } from "@/lib/bible/speakers";
import {
  HIGHLIGHT_COLORS,
  highlightForSharing,
  highlightVerses,
  markContextSeen,
  setPosition,
  setPrefs,
  today,
  useHydrated,
  useStore,
  type Highlight,
  type HighlightColor,
  type Note,
} from "@/lib/store";
import { useReadingSummary } from "@/lib/store/hooks";
import { ShareHighlightSheet } from "@/components/lamplighters/ShareHighlightSheet";
import { NoteSheet } from "./NoteSheet";
import { ListenPlayer } from "./Listen";
import { ReaderSettings } from "./ReaderSettings";
import { useRangeSelect } from "./useRangeSelect";
import { VersionSheet } from "./VersionSheet";

interface Props {
  chapter: Chapter;
  bookName: string;
  card: ContextCard | null;
  note: ChapterNote | null;
  /** Who speaks where (KJV only): verse -> ranges in its text. Null when nothing is marked. */
  speakers?: Record<number, SpeakerSpan[]> | null;
  /** The book's illuminated plate. */
  plate: string;
  prev: ChapterRef | null;
  next: ChapterRef | null;
  versionName: string;
  copyright: string;
  versionLink?: { href: string; label: string };
}

type NoteTarget = { verse: number | null; verseEnd?: number; existing?: Note };

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

export function Reader({ chapter, bookName, card, note, speakers = null, plate, prev, next, versionName, copyright, versionLink }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const ref = useMemo(() => ({ book: chapter.book, chapter: chapter.chapter }), [chapter.book, chapter.chapter]);
  const title = formatRef(ref);

  const allNotes = useStore((s) => s.notes);
  const allHighlights = useStore((s) => s.highlights);
  const reads = useStore((s) => s.reads);
  const speakerColors = useStore((s) => s.prefs.speakerColors !== false);
  // Colors only when this chapter has speech marked, and the reader hasn't turned them off.
  const voices = hydrated && speakerColors && speakers ? speakers : null;
  const hasOther = !!voices && Object.values(voices).some((spans) => spans.some((sp) => sp[2] === "other"));
  const contextSeen = useStore((s) => s.contextSeen);
  const { goal, readToday } = useReadingSummary();

  const notes = useMemo(() => allNotes.filter((n) => n.book === chapter.book && n.chapter === chapter.chapter), [allNotes, chapter.book, chapter.chapter]);
  // Each verse's color; a highlight can cover several verses.
  const highlights = useMemo(() => {
    const m = new Map<number, HighlightColor>();
    for (const h of allHighlights) if (h.book === chapter.book && h.chapter === chapter.chapter) for (let v = h.verseStart; v <= h.verseEnd; v++) m.set(v, h.color);
    return m;
  }, [allHighlights, chapter.book, chapter.chapter]);
  const chapterHighlights = useMemo(() => allHighlights.filter((h) => h.book === chapter.book && h.chapter === chapter.chapter), [allHighlights, chapter.book, chapter.chapter]);
  const notedVerses = useMemo(() => new Set(notes.map((n) => n.verseStart).filter((v): v is number => v != null)), [notes]);
  const chapterReadToday = hydrated && reads.some((r) => r.book === chapter.book && r.chapter === chapter.chapter && r.readOn === today());

  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [sharing, setSharing] = useState<Highlight | null>(null);
  // Listen: the player is open, and which verse it's reading (underlined and kept in view).
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState<number | null>(null);
  useEffect(() => {
    if (spoken == null) return;
    const el = document.getElementById(`v${spoken}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight * 0.6) el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [spoken]);
  const [versionOpen, setVersionOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [status, setStatus] = useState("");
  const [cardOpen, setCardOpen] = useState<boolean | null>(null);
  const topVerse = useRef(1);

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
  const { sel, selectOne, extendTo, movingEnd, extending, setExtending, dragging, onVerseClick, touchWasSelection } = useRangeSelect(textRef);
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

  const focusVerse = useCallback((n: number) => {
    const el = document.getElementById(`v${n}`);
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  }, []);

  const select = useCallback(
    (n: number | null, focus = false) => {
      selectOne(n);
      if (n != null && focus) focusVerse(n);
    },
    [selectOne, focusVerse],
  );

  // Arriving from Go to, a note or a highlight: #v16 selects that verse, #v16-18 those verses.
  useEffect(() => {
    const m = location.hash.match(/^#v(\d+)(?:-(\d+))?$/);
    const a = m ? Number(m[1]) : 0;
    const b = m?.[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > chapter.verses.length) return;
    requestAnimationFrame(() => {
      select(a, true);
      if (b > a) extendTo(b);
    });
  }, [chapter.verses.length, select, extendTo]);

  function say(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => (s === msg ? "" : s)), 2400);
  }

  const label = (s: Span) => formatRef({ ...ref, verse: s.start, verseEnd: s.end });

  async function copyVerses(s: Span) {
    const nums = Array.from({ length: s.end - s.start + 1 }, (_, i) => s.start + i);
    const text = nums
      .filter((n) => verseText(n).trim())
      .map((n) => (s.start === s.end ? verseText(n) : `${n} ${verseText(n)}`))
      .join(" ");
    try {
      await navigator.clipboard.writeText(`${text} (${label(s)} ${chapter.version})`);
      say(`Copied ${label(s)}`);
    } catch {
      say("Copy isn't available in this browser");
    }
  }

  const finish = useCallback(() => {
    finishChapter(ref, chapter.version);
    setJustDone(true);
    requestAnimationFrame(() => document.getElementById("chapter-done")?.scrollIntoView({ block: "center" }));
  }, [ref, chapter.version]);

  /** A note on the selected verses (or, with null, on the whole chapter). */
  function openNote(s: Span | null) {
    if (!s) return setNoteTarget({ verse: null, existing: notes.find((n) => n.verseStart == null) });
    setNoteTarget({ verse: s.start, verseEnd: s.end, existing: notes.find((n) => n.verseStart === s.start && (n.verseEnd ?? n.verseStart) === s.end) });
  }

  // Screen actions for the Go to palette.
  useEffect(
    () =>
      setScreenActions([
        ...(chapterReadToday ? [] : [{ id: "mark", title: `Mark ${title} as read`, subtitle: "Lights your lamp", icon: "circle-check" as const, run: finish }]),
        { id: "explain", title: `Explain ${title} in depth`, subtitle: "Background, key words, connections", icon: "sparkles", run: () => openExplain(ref) },
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
        const step = e.key === "ArrowDown" ? 1 : -1;
        const clamp = (n: number) => Math.max(1, Math.min(chapter.verses.length, n));
        if (e.shiftKey && sel) {
          // Shift: grow or shrink the selection from its moving end.
          const n = clamp((movingEnd() ?? sel.end) + step);
          extendTo(n);
          focusVerse(n);
        } else select(sel == null ? 1 : clamp((step > 0 ? sel.end : sel.start) + step), true);
      } else if (e.key === "Escape" && sel) select(null);
      else if (k === "a") {
        e.preventDefault();
        setTextOpen(true);
      } else if (sel && "1234".includes(k)) highlightVerses(ref, sel.start, sel.end, HIGHLIGHT_COLORS[Number(k) - 1]);
      else if (sel && k === "n") {
        e.preventDefault();
        openNote(sel);
      } else if (sel && k === "c") copyVerses(sel);
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
      {/* Top bar: back, title; version and text controls on desktop. Stays on screen while reading. */}
      <header className="glass sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
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

      <main className={`mx-auto w-full max-w-[760px] px-gutter min-[960px]:pb-16 ${listening ? "pb-[calc(57px+61px+180px+env(safe-area-inset-bottom))] min-[960px]:pb-48" : "pb-[calc(57px+61px+40px+env(safe-area-inset-bottom))]"}`}>
        <header className="flex flex-col items-center gap-1.5 pb-7 pt-10 text-center">
          <p className="text-eyebrow text-text-secondary">{bookName}</p>
          <h1 className="text-numeral text-gold-text">
            <span className="sr-only">{bookName}, chapter </span>
            {chapter.chapter}
          </h1>
          <Fleuron className="mt-2 w-[180px]" />
          {!listening && (
            <button type="button" onClick={() => setListening(true)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 font-medium text-gold-text">
              <span aria-hidden="true" className="icon-[lucide--headphones] size-5" />
              Listen
            </button>
          )}
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
                <div className="flex flex-wrap gap-x-5">
                  <button
                    type="button"
                    onClick={() => select(note.key, true)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-gold-text"
                  >
                    <Icon name="target" className="size-[18px]" />
                    Key verse {chapter.chapter}:{note.key}
                  </button>
                  <button
                    type="button"
                    onClick={() => openExplain(ref)}
                    aria-haspopup="dialog"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-gold-text"
                  >
                    <Icon name="sparkles" className="size-[18px]" />
                    Explain in depth
                  </button>
                </div>
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

        {voices && (
          <p className="mx-auto mb-4 flex max-w-[64ch] flex-wrap items-center gap-x-4 gap-y-1 text-footnote text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-full bg-[var(--speaker-jesus)]" />
              <span className="font-semibold text-[var(--speaker-jesus)]">Words of Jesus</span>
            </span>
            {hasOther && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-3 rounded-full bg-[var(--speaker-other)]" />
                <span className="font-semibold text-[var(--speaker-other)]">Other speakers</span>
              </span>
            )}
            <button type="button" onClick={() => setPrefs({ speakerColors: false })} className="min-h-11 font-medium text-gold-text underline underline-offset-2">
              Turn off colors
            </button>
          </p>
        )}

        <article
          ref={textRef}
          aria-label={`${title}, ${chapter.version}`}
          className={`scripture mx-auto text-text [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none ${dragging ? "select-none" : ""}`}
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            if (!start || touchWasSelection()) return; // a long-press selection isn't a swipe
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
              const isSelected = !!sel && v.number >= sel.start && v.number <= sel.end;
              const isSpoken = spoken === v.number;
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
                  aria-current={isSpoken ? "true" : undefined}
                  aria-label={`Verse ${v.number}${hl ? `, ${SWATCH[hl].label.toLowerCase()} highlight` : ""}${noted ? ", has a note" : ""}`}
                  onClick={(e) => onVerseClick(e, v.number)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (e.shiftKey && sel) extendTo(v.number);
                      else select(sel && sel.start === v.number && sel.end === v.number ? null : v.number);
                    }
                  }}
                  style={hl ? { background: HL_BG[hl] } : undefined}
                  className={`scroll-mt-24 cursor-pointer rounded-[4px] py-px transition-colors duration-150 [box-decoration-break:clone] ${isSpoken ? "underline decoration-gold decoration-2 underline-offset-[6px]" : ""} ${
                    isSelected ? (hl ? "outline-2 outline-offset-1 outline-gold" : "bg-gold-wash") : hl ? "" : "[@media(hover:hover)]:hover:bg-gold-wash/55"
                  }`}
                >
                  {v.number === 1 ? (
                    <>
                      <span aria-hidden="true" className="dropcap leaf-text">
                        {v.text[0]}
                      </span>
                      <span className="sr-only">{v.text[0]}</span>
                      <Spoken text={v.text.slice(1)} spans={shiftSpans(voices?.[v.number], 1)} />
                    </>
                  ) : (
                    <>
                      <sup aria-hidden="true" className="relative -top-[0.35em] mr-[0.25em] align-baseline font-sans text-[0.72em] font-medium text-text-secondary">
                        {v.number}
                      </sup>
                      <Spoken text={v.text} spans={voices?.[v.number]} />
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
              <div className="-mb-2 flex w-full flex-col border-t border-divider pt-1.5 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:justify-center min-[480px]:gap-x-4">
                <Button variant="plain" icon="sparkles" onClick={() => openExplain(ref)} aria-haspopup="dialog">
                  Explain in depth
                </Button>
                <Button variant="plain" icon="hand-heart" onClick={() => openPrayer(ref)} aria-haspopup="dialog">
                  Pray over what you read
                </Button>
                <Button variant="plain" icon="music" onClick={() => openSong(ref)} aria-haspopup="dialog">
                  Make a song
                </Button>
              </div>
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
            <ModK /> go to · <Kbd>←</Kbd> <Kbd>→</Kbd> chapter · <Kbd>↑</Kbd> <Kbd>↓</Kbd> verse · <Kbd>1</Kbd>–<Kbd>4</Kbd> highlight · <Kbd>⇧</Kbd> <Kbd>↓</Kbd> select more · <Kbd>A</Kbd> text
          </p>
        </section>
      </main>

      {/* Thumb bar (phones): the reader's controls, just above the main tab bar, always on screen (DESIGN.md §5.1). */}
      <nav
        aria-label="Reader"
        className={`glass fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 grid grid-cols-[56px_1fr_56px_56px] items-center gap-0.5 border-t border-divider py-1 pl-[max(10px,env(safe-area-inset-left))] pr-[max(10px,env(safe-area-inset-right))] min-[960px]:hidden`}
      >
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

      {/* Listen: docked low, above the thumb bar (DESIGN.md §8 Listen). */}
      {listening && (
        <div className="fixed bottom-[calc(57px+61px+10px+env(safe-area-inset-bottom))] left-1/2 z-[34] w-[min(520px,calc(100%-32px))] -translate-x-1/2 min-[960px]:bottom-6 min-[960px]:ml-[116px]">
          <ListenPlayer chapter={chapter} onVerse={setSpoken} onClose={() => setListening(false)} />
        </div>
      )}

      {/* Verse bar: docked low, above the thumb bar (DESIGN.md §8). Acts on every selected verse. Sits above the player while listening. */}
      <div
        role="toolbar"
        aria-label={sel ? `Actions for ${label(sel)}` : "Verse actions"}
        aria-hidden={!sel}
        inert={!sel}
        className={`fixed left-1/2 z-[35] flex w-[min(520px,calc(100%-32px))] -translate-x-1/2 flex-col gap-2.5 rounded-[22px] bg-surface-raised p-3 shadow-float transition-[translate,opacity] duration-300 ease-out min-[960px]:ml-[116px] ${
          listening ? "bottom-[calc(57px+61px+150px+env(safe-area-inset-bottom))] min-[960px]:bottom-[166px]" : "bottom-[calc(57px+61px+10px+env(safe-area-inset-bottom))] min-[960px]:bottom-6"
        } ${
          sel ? "" : "pointer-events-none translate-y-[140%] opacity-0"
        }`}
      >
        {sel && (
          <>
            <div className="flex items-center justify-between gap-2 pl-2 pr-1">
              <span className="min-w-0">
                <span className="block truncate text-headline">{label(sel)}</span>
                <span role="status" aria-live="polite" className={extending ? "block text-footnote text-gold-text" : "sr-only"}>
                  {extending ? "Tap the last verse" : sel.end > sel.start ? `${sel.end - sel.start + 1} verses selected` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  aria-pressed={extending}
                  onClick={() => setExtending(!extending)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text ${extending ? "bg-gold-wash" : ""}`}
                >
                  <Icon name="list-plus" />
                  Select more
                  <Kbd>⇧</Kbd>
                </button>
                <button type="button" onClick={() => select(null)} aria-label="Close" className="grid size-11 place-items-center rounded-full text-text-secondary">
                  <Icon name="x" className="size-[22px]" />
                </button>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {HIGHLIGHT_COLORS.map((c, i) => {
                const on = colorOf(chapterHighlights, ref, sel) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${SWATCH[c].label} highlight${sel.end > sel.start ? `, ${sel.end - sel.start + 1} verses` : ""}`}
                    title={`${SWATCH[c].label} highlight (${i + 1})`}
                    onClick={() => highlightVerses(ref, sel.start, sel.end, c)}
                    className="grid size-11 place-items-center rounded-full"
                  >
                    <span className={`grid size-[26px] place-items-center rounded-full ${on ? "outline-2 outline-offset-2 outline-text" : ""}`} style={{ background: SWATCH[c].fill }}>
                      {on && <Icon name="check" className="size-3.5 text-surface-raised" />}
                    </span>
                  </button>
                );
              })}
              <span aria-hidden="true" className="mx-1 h-7 w-px bg-divider" />
              <button type="button" onClick={() => openNote(sel)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text">
                <Icon name="notebook-pen" />
                {notes.some((n) => n.verseStart === sel.start && (n.verseEnd ?? n.verseStart) === sel.end) ? "Edit note" : "Note"}
                <Kbd>N</Kbd>
              </button>
              <button type="button" onClick={() => copyVerses(sel)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text">
                <Icon name="copy" />
                Copy
                <Kbd>C</Kbd>
              </button>
              {/* Share to a Circle: the selected verses become one highlight first if they aren't yet. */}
              <button
                type="button"
                onClick={() => {
                  const { highlight, created } = highlightForSharing(ref, sel.start, sel.end);
                  if (created) say(`Highlighted ${label(sel)} in ${SWATCH[highlight.color].label.toLowerCase()} to share it`);
                  setSharing(highlight);
                }}
                aria-haspopup="dialog"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[12px] px-3 font-medium text-gold-text"
              >
                <Icon name="share" />
                Share
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
            verseEnd: noteTarget.verseEnd,
            label: formatRef({ ...ref, verse: noteTarget.verse ?? undefined, verseEnd: noteTarget.verseEnd }),
            quote:
              noteTarget.verse != null
                ? Array.from({ length: (noteTarget.verseEnd ?? noteTarget.verse) - noteTarget.verse + 1 }, (_, i) => verseText(noteTarget.verse! + i)).join(" ")
                : undefined,
          }}
          existing={noteTarget.existing}
        />
      )}
      {sharing && <ShareHighlightSheet highlight={sharing} onClose={() => setSharing(null)} />}
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

function ThumbLink({ href, label, icon }: { href: string | null; label: string; icon: "chevron-left" | "chevron-right" }) {
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

/** A verse's words, with spoken parts in the speaker's color (DESIGN.md §8 Speaker colors). */
function Spoken({ text, spans }: { text: string; spans?: SpeakerSpan[] }) {
  if (!spans?.length) return <>{text}</>;
  return (
    <>
      {speakerSegments(text, spans).map((seg, i) =>
        seg.who ? (
          <span key={i} className={seg.who === "jesus" ? "text-[var(--speaker-jesus)]" : "text-[var(--speaker-other)]"}>
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}
