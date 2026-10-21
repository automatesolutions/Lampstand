"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { checkRefs } from "@/lib/bible/check-refs";
import { explainBlocks } from "@/lib/explain";

// Review of pre-written "In depth" explanations, for a pastor or Bible teacher.
// Works only on a developer's machine (npm run dev); approvals are saved to
// content/explanations and published by committing those files.

interface BookRow {
  code: string;
  name: string;
  chapters: number;
  saved: number;
  reviewed: number;
}
interface Entry {
  status: "draft" | "reviewed";
  text: string;
  model: string;
  generatedAt: string;
  reviewedBy?: string;
  fixed?: string[];
  dropped?: string[];
}

const NAME_KEY = "lampstand:reviewer";

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function ReviewPage() {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [book, setBook] = useState<string>("");
  const [chapters, setChapters] = useState<Record<string, Entry>>({});
  const [chapter, setChapter] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBooks = useCallback(async () => {
    const res = await fetch("/api/review");
    if (!res.ok) return setUnavailable(true);
    const d = (await res.json()) as { books: BookRow[] };
    setBooks(d.books);
    setBook((b) => b || d.books[0]?.code || "");
  }, []);

  useEffect(() => {
    // Remembered on this device only.
    const t = setTimeout(() => {
      setReviewer(readName());
      loadBooks();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBooks]);

  useEffect(() => {
    if (!book) return;
    let alive = true;
    fetch(`/api/review?book=${book}`)
      .then((r) => r.json())
      .then((d: { chapters: Record<string, Entry> }) => {
        if (!alive) return;
        setChapters(d.chapters);
        const first = Object.keys(d.chapters).find((c) => d.chapters[c].status === "draft") ?? Object.keys(d.chapters)[0] ?? "";
        setChapter(first);
        setDraft(d.chapters[first]?.text ?? "");
        setMessage("");
      });
    return () => {
      alive = false;
    };
  }, [book]);

  const entry = chapters[chapter];
  const problems = useMemo(() => (chapter ? checkRefs(draft, { book, chapter: Number(chapter) }) : []), [draft, book, chapter]);
  const edited = entry && draft.trim() !== entry.text;

  function pick(c: string) {
    setChapter(c);
    setDraft(chapters[c]?.text ?? "");
    setMessage("");
  }

  async function save(status?: "draft" | "reviewed") {
    setSaving(true);
    setMessage("");
    try {
      localStorage.setItem(NAME_KEY, reviewer);
    } catch {}
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapter: Number(chapter), text: draft, status, reviewer }),
    });
    const d = (await res.json()) as { entry?: Entry; error?: string; problems?: string[] };
    setSaving(false);
    if (!res.ok || !d.entry) {
      setMessage(`${d.error ?? "Couldn't save."}${d.problems?.length ? ` ${d.problems.join("; ")}` : ""}`);
      return;
    }
    const next = { ...chapters, [chapter]: d.entry };
    setChapters(next);
    loadBooks();
    if (status === "reviewed") {
      const following = Object.keys(next).find((c) => Number(c) > Number(chapter) && next[c].status === "draft");
      setMessage(following ? `Approved. Next draft: chapter ${following}.` : "Approved. No drafts left in this book.");
      if (following) pick(following);
    } else setMessage(status === "draft" ? "Moved back to draft." : "Edits saved.");
  }

  if (unavailable)
    return (
      <main className="mx-auto max-w-[680px] px-gutter py-16">
        <h1 className="text-display">Review</h1>
        <p className="mt-4 text-body text-text-secondary">Review is only available while running Lampstand on your own computer (npm run dev).</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-[1100px] px-gutter py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow text-text-secondary">In depth explanations</p>
          <h1 className="text-display">Review</h1>
        </div>
        <Link href="/" className="min-h-11 content-center font-medium text-gold-text">
          Back to Lampstand
        </Link>
      </header>

      {books && books.length === 0 && <p className="mt-6 text-body text-text-secondary">No explanations are saved yet. Run scripts/generate-explanations.mts first.</p>}

      {books && books.length > 0 && (
        <div className="mt-6 grid gap-6 min-[860px]:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">Book</span>
              <select value={book} onChange={(e) => setBook(e.target.value)} className="min-h-12 rounded-md bg-surface px-3 text-body ring-1 ring-divider">
                {books.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name} · {b.reviewed}/{b.saved} reviewed{b.saved < b.chapters ? ` (${b.chapters - b.saved} not written)` : ""}
                  </option>
                ))}
              </select>
            </label>
            <ul className="flex flex-wrap gap-1.5" aria-label="Chapters">
              {Object.entries(chapters).map(([c, e]) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    aria-current={c === chapter}
                    aria-label={`Chapter ${c}, ${e.status}`}
                    className={`grid size-11 place-items-center rounded-md text-callout font-semibold tabular-nums ring-1 ${
                      c === chapter ? "bg-gold-strong text-on-gold ring-transparent" : e.status === "reviewed" ? "bg-gold-wash ring-divider" : "bg-surface ring-divider"
                    }`}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-footnote text-text-secondary">Gold = reviewed. Plain = draft.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">Your name (shown to readers as the reviewer)</span>
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. Pastor Ana Cruz" className="min-h-12 rounded-md bg-surface px-3 text-body ring-1 ring-divider" />
            </label>
          </aside>

          {entry && (
            <section className="flex flex-col gap-4" aria-label={`Chapter ${chapter}`}>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-title">
                  {books.find((b) => b.code === book)?.name} {chapter}
                </h2>
                <span className={`rounded-full px-3 py-1 text-footnote font-semibold ${entry.status === "reviewed" ? "bg-gold-wash text-gold-text" : "bg-surface text-text-secondary"}`}>
                  {entry.status === "reviewed" ? `Reviewed${entry.reviewedBy ? ` by ${entry.reviewedBy}` : ""}` : "Draft"}
                </span>
                <span className="text-footnote text-text-secondary">
                  {entry.model} · {new Date(entry.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              {(entry.fixed?.length ?? 0) > 0 && <p className="text-footnote text-text-secondary">References corrected while writing: {entry.fixed!.join("; ")}</p>}

              <div className="grid gap-4 min-[1100px]:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-caption text-text-secondary">Text (edit freely; keep the ## headings and - lines)</span>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={28} className="rounded-md bg-surface p-3.5 font-mono text-[0.875rem] leading-relaxed ring-1 ring-divider" />
                </label>
                <div className="flex flex-col gap-2 rounded-md bg-surface-raised p-4 ring-1 ring-divider" aria-label="Preview">
                  <span className="text-caption text-text-secondary">Preview</span>
                  {explainBlocks(draft).map((b, i) =>
                    b.kind === "heading" ? (
                      <h3 key={i} className="mt-2 text-eyebrow text-gold-text">
                        {b.text}
                      </h3>
                    ) : b.kind === "list" ? (
                      <ul key={i} className="list-disc pl-5 text-callout">
                        {b.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={i} className="text-callout">
                        {b.text}
                      </p>
                    ),
                  )}
                </div>
              </div>

              {problems.length > 0 && (
                <p role="alert" className="rounded-md bg-surface px-4 py-3 text-callout">
                  These references don&apos;t exist: {problems.map((p) => `${p.text} (${p.reason})`).join("; ")}
                </p>
              )}
              {message && (
                <p role="status" className="text-callout text-text-secondary">
                  {message}
                </p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <Button variant="primary" icon="check" onClick={() => save("reviewed")} disabled={saving || problems.length > 0}>
                  {edited ? "Save and approve" : "Approve"}
                </Button>
                <Button onClick={() => save()} disabled={saving || !edited}>
                  Save edits as draft
                </Button>
                {entry.status === "reviewed" && (
                  <Button variant="plain" onClick={() => save("draft")} disabled={saving}>
                    Move back to draft
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
