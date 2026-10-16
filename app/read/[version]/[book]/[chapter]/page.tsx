import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Reader } from "@/components/reader/Reader";
import { getProvider } from "@/lib/bible";
import { BOOKS, bookBySlug } from "@/lib/bible/books";
import { versionFromSlug } from "@/lib/bible/provider";
import { formatRef, nextChapter, prevChapter } from "@/lib/bible/refs";
import { chapterNote } from "@/lib/chapter-notes";
import { contextCard } from "@/lib/context-cards";
import { plateSrc } from "@/lib/plates";

type Params = { version: string; book: string; chapter: string };

export async function generateStaticParams(): Promise<Params[]> {
  return BOOKS.flatMap((b) =>
    Array.from({ length: b.chapters }, (_, i) => ({ version: "kjv", book: b.slug, chapter: String(i + 1) })),
  );
}

function resolve(p: Params) {
  const version = versionFromSlug(p.version);
  const book = bookBySlug(p.book);
  const chapter = Number(p.chapter);
  if (!version?.available || !book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return { version, book, chapter };
}

export async function generateMetadata({ params }: PageProps<"/read/[version]/[book]/[chapter]">): Promise<Metadata> {
  const r = resolve(await params);
  return r ? { title: `${formatRef({ book: r.book.code, chapter: r.chapter })} (${r.version.id})` } : {};
}

// Reading params suspends; the skeleton keeps navigation instant (instant-shell-url-data).
export default function ChapterPage({ params }: PageProps<"/read/[version]/[book]/[chapter]">) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <ChapterContent params={params} />
    </Suspense>
  );
}

function ReaderSkeleton() {
  return (
    <div aria-busy="true" className="min-h-dvh bg-bg-soft">
      <div className="h-[calc(52px+env(safe-area-inset-top))]" />
      <div className="mx-auto flex max-w-[64ch] flex-col items-center gap-4 px-gutter pt-10">
        <span className="h-3 w-24 rounded-full bg-surface" />
        <span className="h-16 w-14 rounded-md bg-surface" />
        <span className="sr-only">Opening chapter</span>
        <div className="mt-10 flex w-full flex-col gap-3">
          {[92, 100, 96, 88, 100, 70].map((w, i) => (
            <span key={i} className="h-4 rounded-full bg-surface" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

async function ChapterContent({ params }: { params: PageProps<"/read/[version]/[book]/[chapter]">["params"] }) {
  const r = resolve(await params);
  if (!r) notFound();
  const provider = getProvider(r.version.id);
  const ref = { book: r.book.code, chapter: r.chapter };
  const [chapter, note] = await Promise.all([provider?.chapter(ref), chapterNote(ref)]);
  if (!chapter) notFound();

  return (
    <Reader
      key={`${ref.book}.${ref.chapter}`}
      chapter={chapter}
      bookName={r.book.name}
      card={contextCard(r.book.code) ?? null}
      note={note}
      plate={plateSrc(r.book.code)}
      prev={prevChapter(ref)}
      next={nextChapter(ref)}
      versionName={r.version.name}
      copyright={r.version.copyright}
      versionLink={r.version.link}
    />
  );
}
