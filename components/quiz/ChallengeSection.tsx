"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { BOOKS } from "@/lib/bible/books";
import { useLoad } from "@/lib/lamplighters/client";
import { circleSets, createSet, difficultyLabel, quizError, scopeLabel, startGame, type Difficulty, type Scope } from "@/lib/quiz/client";

const PLAYABLE = BOOKS.filter((b) => b.canon === "all");

/** The Circle's challenges: start one (live or on your own), join an open game, or play a set. */
export function ChallengeSection({ circleId, version }: { circleId: string; version: number }) {
  const sets = useLoad(() => circleSets(circleId), [circleId, version]);
  const [setupOpen, setSetupOpen] = useState(false);
  // Before migration 0012 the section stays hidden.
  if (sets.error && !sets.data) return null;

  return (
    <section aria-labelledby="challenge-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 id="challenge-heading" className="text-eyebrow text-text-secondary">
          Bible challenge
        </h2>
        <button type="button" onClick={() => setSetupOpen(true)} className="flex min-h-11 items-center px-1 text-subhead font-medium text-gold-text">
          New challenge
        </button>
      </div>
      {!sets.data?.length ? (
        <p className="rounded-lg bg-surface px-4 py-3.5 text-subhead text-text-secondary">Play a quiz together, live like a game night, or each on your own time and compare scores.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
          {sets.data.map((s, i) => (
            <li key={s.set_id} className={`flex min-h-16 items-center gap-3 px-4 py-2.5 ${i ? "border-t border-divider" : ""}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-headline">
                  {scopeLabel(s.scope)} · {difficultyLabel(s.difficulty)}
                </span>
                <span className="block text-footnote text-text-secondary">
                  {s.question_count} questions · by {s.created_by}
                  {s.my_score != null ? ` · you: ${s.my_score.toLocaleString("en-US")}${s.my_finished ? "" : " so far"}` : ""}
                  {s.players ? ` · ${s.players} played on their own` : ""}
                </span>
              </span>
              {s.open_game ? (
                <Link href={`/challenge/${s.open_game}`} className="inline-flex min-h-11 items-center rounded-md bg-gold-strong px-3 font-semibold text-on-gold">
                  Join live
                </Link>
              ) : (
                <Link href={`/challenge/set/${s.set_id}`} className="inline-flex min-h-11 items-center rounded-md px-2 font-medium text-gold-text">
                  {s.my_finished ? "Scores" : s.my_score != null ? "Continue" : "Play"}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {setupOpen && <SetupSheet circleId={circleId} onClose={() => setSetupOpen(false)} />}
    </section>
  );
}

/** Choose what the challenge covers, then host it live or play it on your own time. */
function SetupSheet({ circleId, onClose }: { circleId: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<Scope["kind"]>("bible");
  const [book, setBook] = useState("JHN");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(3);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chapters = PLAYABLE.find((b) => b.code === book)?.chapters ?? 1;
  const scope: Scope = kind === "bible" ? { kind } : kind === "book" ? { kind, book } : { kind, book, from: Math.min(from, to), to: Math.max(from, to) };

  async function go(live: boolean) {
    setBusy(true);
    setError("");
    try {
      const setId = await createSet(circleId, scope, difficulty, Number(count));
      if (live) {
        const g = await startGame(setId);
        router.push(`/challenge/${g.game_id}`);
      } else router.push(`/challenge/set/${setId}`);
    } catch (e) {
      setError(quizError(e));
      setBusy(false);
    }
  }

  const field = "min-h-12 rounded-md bg-surface px-3 text-body ring-1 ring-divider focus:ring-2 focus:ring-gold";
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="New Bible challenge"
      description="Choose the questions, then play live or on your own time"
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <Button disabled={busy} onClick={() => go(false)}>
            On our own time
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => go(true)}>
            Host a live game
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <span className="text-caption text-text-secondary">Questions from</span>
          <Segmented<Scope["kind"]> label="Questions from" value={kind} onChange={setKind} options={[{ value: "bible", label: "Whole Bible" }, { value: "book", label: "A book" }, { value: "chapters", label: "Chapters" }]} />
        </div>
        {kind !== "bible" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-caption text-text-secondary">Book</span>
            <select value={book} onChange={(e) => (setBook(e.target.value), setFrom(1), setTo(1))} className={field}>
              {PLAYABLE.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "chapters" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">From chapter</span>
              <input type="number" inputMode="numeric" min={1} max={chapters} value={from} onChange={(e) => setFrom(Math.max(1, Math.min(chapters, Number(e.target.value) || 1)))} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">To chapter</span>
              <input type="number" inputMode="numeric" min={1} max={chapters} value={to} onChange={(e) => setTo(Math.max(1, Math.min(chapters, Number(e.target.value) || 1)))} className={field} />
            </label>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-caption text-text-secondary">Difficulty</span>
          <Segmented<Difficulty> label="Difficulty" value={difficulty} onChange={setDifficulty} options={[{ value: "mixed", label: "Mixed" }, { value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-caption text-text-secondary">Number of questions</span>
          <Segmented<string> label="Number of questions" value={count} onChange={setCount} options={[{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "15", label: "15" }]} />
        </div>
        <p className="text-footnote text-text-secondary">20 seconds a question. Every answer comes from the KJV text, with the verse shown after each question.</p>
        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
