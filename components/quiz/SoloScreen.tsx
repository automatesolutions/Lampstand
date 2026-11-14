"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/lamplighters/Mascot";
import { ErrorState, LoadingRows } from "@/components/lamplighters/States";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useLampProfile } from "@/lib/lamplighters/client";
import { difficultyLabel, quizError, scopeLabel, setScores, soloAnswer, soloNext, timeLeft, type SoloResult, type SoloStep } from "@/lib/quiz/client";
import { Answers, Evidence, Leaderboard, Timer } from "./parts";

/**
 * A challenge set played on your own time (DESIGN.md §11 Bible challenge). Each question
 * is timed from when the database first showed it, so reloading doesn't restart the clock.
 * At the end, your score beside everyone in the Circle who played the same set.
 */
export function SoloScreen({ id }: { id: string }) {
  const me = useLampProfile();
  const uid = me.userId;
  const [step, setStep] = useState<SoloStep | null>(null);
  const [result, setResult] = useState<SoloResult | null>(null);
  const [scores, setScoresState] = useState<Awaited<ReturnType<typeof setScores>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const next = useCallback(async () => {
    setBusy(true);
    try {
      const s = await soloNext(id);
      setOffset(Date.parse(s.now ?? new Date().toISOString()) - Date.now());
      setStep(s);
      setResult(null);
      if (s.done) setScoresState(await setScores(id));
      setError("");
    } catch (e) {
      setError(quizError(e));
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the first question
    if (uid) next();
  }, [uid, next]);

  const open = !!step && !step.done && !result;
  const left = open ? timeLeft(step.shown_at, step.seconds, offset, now) : 0;
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [open]);

  const sent = useRef(-1);
  const pick = useCallback(
    async (choice: number | null) => {
      if (!step || step.done || sent.current === step.index) return;
      sent.current = step.index;
      setBusy(true);
      try {
        setResult(await soloAnswer(id, step.index, choice));
      } catch (e) {
        setError(quizError(e));
      } finally {
        setBusy(false);
      }
    },
    [id, step],
  );
  // Time ran out: it counts as unanswered.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the timer ran out: send "no answer"
    if (open && left <= 0) pick(null);
  }, [open, left, pick]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-divider px-2 pt-[env(safe-area-inset-top)]">
        <Link href={step ? `/chat/${step.circle_id}` : "/circles"} className="flex min-h-11 items-center gap-0.5 rounded-md pr-2 text-body text-gold-text">
          <Icon name="chevron-left" className="size-6" />
          <span className="sr-only">Back to </span>Chat
        </Link>
        <div className="min-w-0 flex-1 py-1.5 text-center">
          <h1 className="truncate text-headline">Bible challenge</h1>
          <p className="truncate text-footnote text-text-secondary">{step ? `${scopeLabel(step.scope)} · ${difficultyLabel(step.difficulty)} · on your own` : ""}</p>
        </div>
        <span className="w-[72px]" />
      </header>

      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-5 px-gutter py-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {!me.ready || (!step && !error) ? (
          <LoadingRows rows={3} label="Loading the challenge" />
        ) : !uid ? (
          <ErrorState message="Sign in to play with your Circle." />
        ) : error && !step ? (
          <ErrorState message={error} onRetry={next} />
        ) : step?.done ? (
          <section aria-labelledby="done-title" className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <Mascot mood="cheering" size={88} />
              <h2 id="done-title" className="text-title">
                You scored {step.score.toLocaleString("en-US")}
              </h2>
              <p className="text-body text-text-secondary">Here&apos;s how your Circle did on this set.</p>
            </div>
            {scores && <Leaderboard players={scores.map((s) => ({ user_id: s.user_id, name: s.finished ? s.name : `${s.name} (${s.answered} of ${step.count})`, avatar: s.avatar, score: s.score, answered: s.finished }))} me={uid} />}
            <Link href={`/chat/${step.circle_id}`} className="self-center text-body font-medium text-gold-text underline underline-offset-2">
              Back to the Circle&apos;s chat
            </Link>
          </section>
        ) : step ? (
          <section aria-labelledby="q-text" className="flex flex-col gap-4">
            <p className="text-eyebrow text-text-secondary">
              Question {step.index + 1} of {step.count} · {step.score.toLocaleString("en-US")} points
            </p>
            {open && <Timer msLeft={left} seconds={step.seconds} />}
            <h2 id="q-text" className="text-title">
              {step.question.question}
            </h2>
            <Answers q={result ?? step.question} mine={result ? result.choice : null} disabled={busy || !open} onPick={(c) => pick(c)} />
            {result && (
              <>
                <p role="status" className="text-center text-title">
                  {result.correct ? `Right! +${result.points.toLocaleString("en-US")}` : result.choice == null ? "Time's up" : "Not this time"}
                </p>
                <Evidence q={result} />
                <Button variant="primary" size="large" disabled={busy} onClick={next}>
                  {step.index + 1 >= step.count ? "See the scores" : "Next question"}
                </Button>
              </>
            )}
          </section>
        ) : null}
        {error && step && (
          <p role="alert" className="text-center text-callout text-danger">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
