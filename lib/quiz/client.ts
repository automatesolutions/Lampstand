"use client";

// The Circle Bible challenge from the browser. Every rule (members only, hidden answers,
// timing and scoring) is in the database (supabase/migrations/0012); these call it.

import { bookByCode } from "@/lib/bible/books";
import { LampError } from "@/lib/lamplighters/client";
import { supabase } from "@/lib/supabase/client";

export type Difficulty = "easy" | "medium" | "hard" | "mixed";
export type Scope = { kind: "bible" } | { kind: "book"; book: string } | { kind: "chapters"; book: string; from: number; to: number };

export interface QuizQuestion {
  index: number;
  question: string;
  choices: string[];
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  difficulty: "easy" | "medium" | "hard";
  /** Only once the question has closed. */
  answer?: number;
  evidence?: string;
}

export interface QuizPlayer {
  user_id: string;
  name: string;
  avatar: string | null;
  score: number;
  answered: boolean;
}

export interface GameState {
  id: string;
  circle_id: string;
  code: string;
  state: "lobby" | "question" | "reveal" | "finished";
  host_id: string | null;
  index: number;
  count: number;
  seconds: number;
  scope: Scope;
  difficulty: Difficulty;
  started_at: string | null;
  /** When the game last moved on (anyone may move it on after 45 seconds). */
  changed_at: string;
  /** The database's clock when this was read, to time questions fairly. */
  now: string;
  joined: boolean;
  question: QuizQuestion | null;
  mine: { choice: number; points: number; correct: boolean | null } | null;
  players: QuizPlayer[];
}

export interface CircleSet {
  set_id: string;
  scope: Scope;
  difficulty: Difficulty;
  question_count: number;
  created_at: string;
  created_by: string;
  open_game: string | null;
  open_code: string | null;
  my_score: number | null;
  my_finished: boolean | null;
  players: number;
}

const QUIZ_ERRORS: Record<string, string> = {
  not_enough_questions: "There aren't enough questions for that yet. Try the whole Bible, another book, or Mixed.",
  game_not_found: "No open game has that code in your Circles. Check the code with your host.",
  host_only: "Only the host can do that right now.",
  question_closed: "That question has closed.",
  already_answered: "You've already answered this one.",
  not_yet: "Wait for the timer or for everyone to answer.",
  not_now: "Not right now.",
  not_a_player: "Join the game first.",
  "rate_limited:quiz_set": "That's a lot of challenges for one day. Try again tomorrow.",
  "rate_limited:quiz_game": "That's a lot of games for one day. Try again tomorrow.",
};

/** A friendly sentence for a challenge error. */
export function quizError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  const code = raw.match(/^[a-z_]+(:[a-z_]+)?/)?.[0] ?? "";
  if (QUIZ_ERRORS[code]) return QUIZ_ERRORS[code];
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Try again when you're back.";
  return "Something went wrong. Try again in a moment.";
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const db = supabase();
  if (!db) throw new LampError("sign_in_required");
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new LampError(error.message);
  return data as T;
}

export const createSet = (circleId: string, scope: Scope, difficulty: Difficulty, count: number) =>
  rpc<string>("create_quiz_set", { p_circle: circleId, p_scope: scope, p_difficulty: difficulty, p_count: count });
export const startGame = async (setId: string) => (await rpc<{ game_id: string; code: string }[]>("start_quiz_game", { p_set: setId }))[0];
export const joinGame = (code: string) => rpc<string>("join_quiz_game", { p_code: code });
export const gameState = (gameId: string) => rpc<GameState>("quiz_state", { p_game: gameId });
export const advance = (gameId: string) => rpc<void>("quiz_advance", { p_game: gameId });
export const reveal = (gameId: string) => rpc<void>("quiz_reveal", { p_game: gameId });
export const answer = (gameId: string, index: number, choice: number) => rpc<void>("quiz_answer", { p_game: gameId, p_index: index, p_choice: choice });
export const circleSets = (circleId: string) => rpc<CircleSet[]>("circle_quiz_sets", { p_circle: circleId });

export interface SoloStep {
  done: boolean;
  index: number;
  count: number;
  seconds: number;
  score: number;
  shown_at: string;
  now: string;
  scope: Scope;
  difficulty: Difficulty;
  circle_id: string;
  question: QuizQuestion;
}
export interface SoloResult extends QuizQuestion {
  correct: boolean;
  points: number;
  choice: number | null;
}
export const soloNext = (setId: string) => rpc<SoloStep>("quiz_async_next", { p_set: setId });
export const soloAnswer = (setId: string, index: number, choice: number | null) => rpc<SoloResult>("quiz_async_answer", { p_set: setId, p_index: index, p_choice: choice });
export const setScores = (setId: string) => rpc<{ user_id: string; name: string; avatar: string | null; score: number; finished: boolean; answered: number }[]>("quiz_set_scores", { p_set: setId });

/** "John 1–3", "Genesis", "The whole Bible". */
export function scopeLabel(scope: Scope): string {
  if (scope.kind === "bible") return "The whole Bible";
  const name = bookByCode(scope.book)?.name ?? scope.book;
  if (scope.kind === "book") return name;
  return scope.from === scope.to ? `${name} ${scope.from}` : `${name} ${scope.from}–${scope.to}`;
}

export const difficultyLabel = (d: Difficulty) => ({ easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Mixed" })[d];

/** Milliseconds left on a question, using the database's clock (offset = its now minus ours). */
export function timeLeft(startedAt: string | null, seconds: number, offsetMs: number, nowMs = Date.now()): number {
  if (!startedAt) return seconds * 1000;
  return Math.max(0, Date.parse(startedAt) + seconds * 1000 - (nowMs + offsetMs));
}
