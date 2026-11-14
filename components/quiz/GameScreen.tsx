"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/lamplighters/Avatar";
import { Mascot } from "@/components/lamplighters/Mascot";
import { ErrorState, LoadingRows } from "@/components/lamplighters/States";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useLampProfile } from "@/lib/lamplighters/client";
import { advance, answer, difficultyLabel, gameState, joinGame, quizError, reveal, scopeLabel, timeLeft, type GameState } from "@/lib/quiz/client";
import { supabase } from "@/lib/supabase/client";
import { Answers, Evidence, Leaderboard, Timer } from "./parts";

/**
 * A live Circle Bible challenge (DESIGN.md §11 Bible challenge): lobby with the join code,
 * timed questions, the answer and leaderboard after each, then the podium. The database
 * runs the game; this screen shows it and follows changes live (Realtime, or every few
 * seconds without it). A dropped player comes back to the same place and score.
 */
export function GameScreen({ id }: { id: string }) {
  const me = useLampProfile();
  const uid = me.userId;
  const [g, setG] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0); // the database's clock minus ours
  const [now, setNow] = useState(() => Date.now());
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const s = await gameState(id);
      setOffset(Date.parse(s.now) - Date.now());
      setG(s);
      setError("");
    } catch (e) {
      setError(quizError(e));
    } finally {
      loading.current = false;
    }
  }, [id]);

  // Live: the game row and the players' rows (scores) change as people play.
  useEffect(() => {
    if (!uid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the game, then follows it live
    load();
    const db = supabase();
    if (!db) return;
    let live = false;
    const ch = db
      .channel(`quiz:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_games", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_players", filter: `game_id=eq.${id}` }, () => load())
      .subscribe((s) => (live = s === "SUBSCRIBED"));
    const poll = setInterval(() => !live && document.visibilityState === "visible" && load(), 3000);
    const onVisible = () => document.visibilityState === "visible" && load(); // back from another app: catch up
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      db.removeChannel(ch);
    };
  }, [id, uid, load]);

  // The countdown, and closing the question when time is up (anyone can, so a host who
  // dropped out doesn't stall the game).
  const left = g?.state === "question" ? timeLeft(g.started_at, g.seconds, offset, now) : 0;
  useEffect(() => {
    // Ticks while a question is open (the countdown) and while it's shown (the 45-second rule).
    if (g?.state !== "question" && g?.state !== "reveal") return;
    const t = setInterval(() => setNow(Date.now()), g.state === "question" ? 250 : 1000);
    return () => clearInterval(t);
  }, [g?.state]);
  const closing = useRef(-1);
  useEffect(() => {
    if (g?.state === "question" && left <= 0 && closing.current !== g.index) {
      closing.current = g.index;
      reveal(id).then(load, load);
    }
  }, [g?.state, g?.index, left, id, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setStatus("");
    try {
      await fn();
      await load();
    } catch (e) {
      setStatus(quizError(e));
    } finally {
      setBusy(false);
    }
  };

  const host = !!g && g.host_id === uid;
  const hostName = g?.players.find((p) => p.user_id === g.host_id)?.name ?? "the host";
  const answeredCount = g?.players.filter((p) => p.answered).length ?? 0;
  const stuckFor = g ? now + offset - Date.parse(g.changed_at) : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-divider px-2 pt-[env(safe-area-inset-top)]">
        <Link href={g ? `/chat/${g.circle_id}` : "/circles"} className="flex min-h-11 items-center gap-0.5 rounded-md pr-2 text-body text-gold-text">
          <Icon name="chevron-left" className="size-6" />
          <span className="sr-only">Leave the game, back to </span>Chat
        </Link>
        <div className="min-w-0 flex-1 py-1.5 text-center">
          <h1 className="truncate text-headline">Bible challenge</h1>
          <p className="truncate text-footnote text-text-secondary">{g ? `${scopeLabel(g.scope)} · ${difficultyLabel(g.difficulty)}` : ""}</p>
        </div>
        <span className="w-[72px]" />
      </header>

      <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-5 px-gutter py-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {!me.ready || (!g && !error) ? (
          <LoadingRows rows={3} label="Loading the game" />
        ) : !uid ? (
          <ErrorState message="Sign in to play with your Circle." />
        ) : error && !g ? (
          <ErrorState message={error} onRetry={load} />
        ) : g && !g.joined && g.state !== "finished" ? (
          <section className="flex flex-col items-center gap-4 py-8 text-center">
            <Mascot mood="waving" size={96} />
            <p className="text-title">Join this game?</p>
            <p className="text-body text-text-secondary">{g.players.length} playing. Your Circle can join with code {g.code}.</p>
            <Button variant="primary" size="large" disabled={busy} onClick={() => act(() => joinGame(g.code))}>
              Join the game
            </Button>
          </section>
        ) : g?.state === "lobby" ? (
          <section aria-labelledby="lobby-title" className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-surface px-5 py-6 text-center">
              <p id="lobby-title" className="text-eyebrow text-text-secondary">Join code</p>
              <p className="font-display text-[3rem] font-semibold tracking-[0.18em] text-gold-text" aria-label={`Join code ${g.code.split("").join(" ")}`}>
                {g.code}
              </p>
              <p className="text-subhead text-text-secondary">Your Circle can join from the Circle&apos;s page or with this code on Circles.</p>
            </div>
            <h2 className="px-1 text-eyebrow text-text-secondary">
              {g.players.length} {g.players.length === 1 ? "player" : "players"}
            </h2>
            <ul className="flex flex-wrap gap-3" aria-live="polite">
              {g.players.map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 rounded-full bg-surface-raised py-1 pl-1 pr-3 ring-1 ring-divider/60">
                  <Avatar id={p.avatar} size={32} />
                  <span className="text-subhead">{p.name}{p.user_id === uid ? " (you)" : ""}</span>
                </li>
              ))}
            </ul>
            <p className="text-footnote text-text-secondary">
              {g.count} questions, {g.seconds} seconds each. Points for each right answer, more for quick ones.
            </p>
            {host ? (
              <Button variant="primary" size="large" disabled={busy} onClick={() => act(() => advance(id))}>
                Start the game
              </Button>
            ) : (
              <p className="text-center text-body text-text-secondary">Waiting for {hostName} to start.</p>
            )}
          </section>
        ) : g?.question && (g.state === "question" || g.state === "reveal") ? (
          <section aria-labelledby="q-text" className="flex flex-col gap-4">
            <p className="text-eyebrow text-text-secondary">
              Question {g.index + 1} of {g.count}
            </p>
            {g.state === "question" && <Timer msLeft={left} seconds={g.seconds} />}
            <h2 id="q-text" className="text-title">
              {g.question.question}
            </h2>
            <Answers q={g.question} mine={g.mine?.choice ?? null} disabled={busy || g.state !== "question"} onPick={(c) => act(() => answer(id, g.index, c))} />
            {g.state === "question" ? (
              <p role="status" className="text-center text-subhead text-text-secondary">
                {g.mine ? "Answer locked in. " : ""}
                {answeredCount} of {g.players.length} answered
              </p>
            ) : (
              <>
                <p role="status" className="text-center text-title">
                  {g.mine?.correct ? `Right! +${g.mine.points.toLocaleString("en-US")}` : g.mine ? "Not this time" : "Time's up"}
                </p>
                <Evidence q={g.question} />
                <h3 className="px-1 text-eyebrow text-text-secondary">Leaderboard</h3>
                <Leaderboard players={g.players} me={uid} limit={5} />
              </>
            )}
            {host && g.state === "question" && (
              <Button variant="plain" disabled={busy} onClick={() => act(() => reveal(id))}>
                Close this question
              </Button>
            )}
            {g.state === "reveal" &&
              (host || stuckFor > 45_000 ? (
                <Button variant="primary" size="large" disabled={busy} onClick={() => act(() => advance(id))}>
                  {g.index + 1 >= g.count ? "See the podium" : "Next question"}
                </Button>
              ) : (
                <p className="text-center text-body text-text-secondary">Waiting for {hostName}.</p>
              ))}
          </section>
        ) : g?.state === "finished" ? (
          <section aria-labelledby="podium-title" className="flex flex-col gap-5">
            <h2 id="podium-title" className="text-center text-title">
              Well played, everyone!
            </h2>
            <Podium players={g.players.slice(0, 3)} />
            <Leaderboard players={g.players} me={uid} />
            <Link href={`/chat/${g.circle_id}`} className="self-center text-body font-medium text-gold-text underline underline-offset-2">
              Back to the Circle&apos;s chat
            </Link>
          </section>
        ) : null}
        <p role="alert" className="text-center text-callout text-danger">
          {status}
        </p>
      </main>
    </div>
  );
}

/** The top three: second, first (tallest), third. */
function Podium({ players }: { players: GameState["players"] }) {
  const order = [players[1], players[0], players[2]];
  const heights = ["h-20", "h-28", "h-14"];
  const places = ["2nd", "1st", "3rd"];
  return (
    <ol className="flex items-end justify-center gap-3" aria-label="Podium">
      {order.map((p, i) =>
        p ? (
          <li key={p.user_id} className="flex w-[30%] max-w-[150px] flex-col items-center gap-1.5 text-center">
            {i === 1 && <Mascot mood="cheering" size={64} />}
            <Avatar id={p.avatar} size={i === 1 ? 56 : 44} />
            <span className="w-full truncate text-headline">{p.name}</span>
            <span className="text-footnote tabular-nums text-text-secondary">{p.score.toLocaleString("en-US")}</span>
            <span className={`grid w-full place-items-center rounded-t-lg ${i === 1 ? "bg-gold-wash" : "bg-surface"} ${heights[i]}`}>
              <span className="font-display text-[1.5rem] font-semibold text-gold-text">{places[i]}</span>
            </span>
          </li>
        ) : (
          <li key={i} className="w-[30%] max-w-[150px]" aria-hidden="true" />
        ),
      )}
    </ol>
  );
}
