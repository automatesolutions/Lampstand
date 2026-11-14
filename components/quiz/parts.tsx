"use client";

import { Avatar } from "@/components/lamplighters/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatRef } from "@/lib/bible/refs";
import type { QuizPlayer, QuizQuestion } from "@/lib/quiz/client";

const LETTERS = ["A", "B", "C", "D"];
// One pigment per answer, always with its letter, so color is never the only signal.
const EDGE = ["var(--pg-law)", "var(--pg-history)", "var(--pg-prophets)", "var(--pg-letters)"];

/**
 * The four answers. Before the question closes they're buttons; after, the right one gets
 * a check and "Correct", and mine says "Your answer".
 */
export function Answers({
  q,
  mine,
  disabled,
  onPick,
}: {
  q: QuizQuestion;
  mine: number | null;
  disabled: boolean;
  onPick?: (choice: number) => void;
}) {
  const revealed = q.answer != null;
  return (
    <ul className="grid gap-2.5 min-[560px]:grid-cols-2">
      {q.choices.map((c, i) => {
        const right = revealed && q.answer === i;
        const picked = mine === i;
        return (
          <li key={i}>
            <button
              type="button"
              disabled={disabled || revealed || mine != null}
              aria-pressed={picked}
              onClick={() => onPick?.(i)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-lg border-l-[6px] px-4 py-3 text-left text-headline transition-colors disabled:cursor-default ${
                right ? "bg-gold-wash ring-2 ring-gold" : picked ? "bg-surface-raised ring-2 ring-text" : "bg-surface-raised shadow-soft ring-1 ring-divider/60"
              } ${revealed && !right ? "opacity-70" : ""}`}
              style={{ borderLeftColor: EDGE[i] }}
            >
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-surface font-display text-[1.125rem] font-semibold">
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="sr-only">{LETTERS[i]}: </span>
                {c}
                {(right || picked) && (
                  <span className="mt-0.5 block text-footnote font-semibold text-gold-text">
                    {[right ? "Correct" : "", picked ? "Your answer" : ""].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              {right && <Icon name="check" className="size-6 text-gold-text" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Where the answer is in the text: the reference and the KJV words. */
export function Evidence({ q }: { q: QuizQuestion }) {
  if (!q.evidence) return null;
  return (
    <blockquote className="flex flex-col gap-1 rounded-md border-l-2 border-gold bg-surface px-4 py-3">
      <span className="font-scripture text-body">&ldquo;{q.evidence}&rdquo;</span>
      <span className="text-footnote font-semibold text-gold-text">{formatRef({ book: q.book, chapter: q.chapter, verse: q.verse_start, verseEnd: q.verse_end })} KJV</span>
    </blockquote>
  );
}

/** Players by score. `me` gets "(you)". */
export function Leaderboard({ players, me, limit }: { players: QuizPlayer[]; me: string | null; limit?: number }) {
  const shown = limit ? players.slice(0, limit) : players;
  return (
    <ol className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
      {shown.map((p, i) => (
        <li key={p.user_id} className={`flex min-h-14 items-center gap-3 px-4 py-2 ${i ? "border-t border-divider" : ""} ${p.user_id === me ? "bg-gold-wash" : ""}`}>
          <span className="w-6 text-center font-display text-[1.25rem] font-semibold text-gold-text">{i + 1}</span>
          <Avatar id={p.avatar} size={32} />
          <span className="min-w-0 flex-1 truncate text-headline">
            {p.name}
            {p.user_id === me ? " (you)" : ""}
          </span>
          <span className="tabular-nums text-headline">{p.score.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ol>
  );
}

/** A thin bar that empties as time runs out, plus the seconds left in words for everyone. */
export function Timer({ msLeft, seconds }: { msLeft: number; seconds: number }) {
  const s = Math.ceil(msLeft / 1000);
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
        <span className="block h-full rounded-full bg-gold motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${Math.min(100, (msLeft / (seconds * 1000)) * 100)}%` }} />
      </span>
      <span className="w-14 text-right text-headline tabular-nums" aria-label={`${s} seconds left`}>
        {s}s
      </span>
    </div>
  );
}
