"use client";

import { useEffect, useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import { SWATCH } from "@/lib/highlights/colors";
import { friendly, myCircles, shareHighlight, useLoad, type CircleSummary } from "@/lib/lamplighters/client";
import { listNames } from "@/lib/list";
import { useStore, type Highlight } from "@/lib/store";
import { syncNow, useSyncStatus } from "@/lib/sync";

/**
 * Share one of my highlights to my Circles (DESIGN.md §11 Share a highlight). Shows the
 * verses as they'll appear, the Circles to pick, and two choices that are off until
 * chosen: my note on these verses, and the summary. The words sent are KJV.
 */
export function ShareHighlightSheet({ highlight, onClose }: { highlight: Highlight; onClose: () => void }) {
  const { userId, ready } = useSyncStatus();
  const circles = useLoad(userId ? myCircles : null, [userId]);
  const notes = useStore((s) => s.notes);
  const note = notes.find((n) => n.book === highlight.book && n.chapter === highlight.chapter && n.verseStart === highlight.verseStart && (n.verseEnd ?? n.verseStart) === highlight.verseEnd);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [withNote, setWithNote] = useState(false);
  const [withSummary, setWithSummary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const ref = formatRef({ book: highlight.book, chapter: highlight.chapter, verse: highlight.verseStart, verseEnd: highlight.verseEnd });

  // One Circle: pick it already.
  const list = circles.data ?? [];
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- once the list has loaded
    if (list.length === 1) setPicked(new Set([list[0].id]));
  }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function share() {
    setBusy(true);
    setStatus("");
    try {
      await syncNow(true); // the highlight must be in the account before it can be shared
      const res = await shareHighlight(highlight.id, [...picked], withNote && note ? note.body : "", withSummary);
      const name = (id: string) => list.find((c: CircleSummary) => c.id === id)?.name ?? "a Circle";
      const parts = [
        res.shared.length ? `Shared to ${listNames(res.shared.map(name))}.` : "",
        res.already.length ? `Already shared to ${listNames(res.already.map(name))}.` : "",
        Object.keys(res.failed).length ? `Couldn't share to ${listNames(Object.keys(res.failed).map(name))}. ${friendly(new Error(Object.values(res.failed)[0]))}` : "",
      ];
      setStatus(parts.filter(Boolean).join(" "));
      if (!Object.keys(res.failed).length) setPicked(new Set());
    } catch (e) {
      setStatus(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  const signedOut = ready && !userId;

  return (
    <>
      <Sheet
        open
        onOpenChange={(o) => !o && onClose()}
        title="Share to a Circle"
        description={`Share ${ref} with your Circles`}
        footer={
          signedOut ? (
            <Button variant="primary" size="large" icon="log-in" onClick={() => setSignInOpen(true)}>
              Sign in to share
            </Button>
          ) : (
            <Button variant="primary" size="large" icon="share" disabled={busy || picked.size === 0} onClick={share}>
              {busy ? "Sharing" : picked.size > 1 ? `Share to ${picked.size} Circles` : "Share"}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4 pb-2">
          <blockquote className="flex flex-col gap-1.5 rounded-md border-l-[3px] bg-surface px-4 py-3" style={{ borderColor: SWATCH[highlight.color].fill }}>
            <span className="text-footnote font-semibold text-gold-text">
              {ref} KJV<span className="sr-only">, {SWATCH[highlight.color].label.toLowerCase()} highlight</span>
            </span>
            {withNote && note && <span className="text-body">{note.body}</span>}
            {withSummary && highlight.summary && <span className="text-callout text-text-secondary">{highlight.summary}</span>}
          </blockquote>

          {signedOut ? (
            <p className="text-body text-text-secondary">Circles need an account. Sign in to share highlights with your friends.</p>
          ) : circles.error && !circles.data ? (
            <p role="alert" className="text-callout text-danger">{circles.error}</p>
          ) : circles.data && list.length === 0 ? (
            <p className="text-body text-text-secondary">You&apos;re not in a Circle yet. Start one on Circles, then share your highlights there.</p>
          ) : (
            <fieldset className="flex flex-col">
              <legend className="mb-1.5 px-1 text-eyebrow text-text-secondary">Your Circles</legend>
              {list.map((c) => (
                <label key={c.id} className="flex min-h-14 items-center gap-3 rounded-md px-1">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="size-5 accent-[var(--gold-strong)]" />
                  <span className="text-headline">{c.name}</span>
                </label>
              ))}
            </fieldset>
          )}

          {!signedOut && (note || highlight.summary) && (
            <fieldset className="flex flex-col border-t border-divider pt-2">
              <legend className="sr-only">Add to the share</legend>
              {note && (
                <label className="flex min-h-14 items-center gap-3 px-1">
                  <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} className="size-5 accent-[var(--gold-strong)]" />
                  <span>
                    <span className="block text-headline">Add my note</span>
                    <span className="line-clamp-1 block text-footnote text-text-secondary">{note.body}</span>
                  </span>
                </label>
              )}
              {highlight.summary && (
                <label className="flex min-h-14 items-center gap-3 px-1">
                  <input type="checkbox" checked={withSummary} onChange={(e) => setWithSummary(e.target.checked)} className="size-5 accent-[var(--gold-strong)]" />
                  <span>
                    <span className="block text-headline">Add the summary</span>
                    <span className="block text-footnote text-text-secondary">Written by AI to help you remember these verses</span>
                  </span>
                </label>
              )}
            </fieldset>
          )}

          <p role="status" aria-live="polite" className="text-callout">
            {status}
          </p>
        </div>
      </Sheet>
      <AccountSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}
