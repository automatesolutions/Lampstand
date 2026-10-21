"use client";

// On-device store for guest mode. Shapes mirror supabase/migrations so the data
// can sync to an account later without reshaping.

import { useMemo, useSyncExternalStore } from "react";
import { BOOKS } from "@/lib/bible/books";
import type { ChapterRef, VersionId } from "@/lib/bible/types";
import { toISODate, type ISODate } from "@/lib/streak";

export type Theme = "system" | "light" | "dark";
export type ScriptureFont = "serif" | "sans";

export const TEXT_SIZES = [16, 17, 19, 21, 23, 26] as const;
export const LEADINGS = [1.6, 1.78, 2] as const; // Snug, Easy, Airy (DESIGN.md §3)

/** Stored names match `highlights.color` in supabase/migrations. */
export const HIGHLIGHT_COLORS = ["gold", "sky", "sage", "rose"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface Highlight {
  id: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  color: HighlightColor;
  createdAt: string;
}

export interface ChapterRead extends ChapterRef {
  version: VersionId;
  readOn: ISODate;
  completedAt: string;
}

export interface Note {
  id: string;
  book: string;
  chapter: number;
  verseStart: number | null; // null = note on the whole chapter
  verseEnd: number | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  chaptersPerDay: number;
  effectiveFrom: ISODate;
}

export interface Position extends ChapterRef {
  version: VersionId;
  verse: number;
  updatedAt?: string; // ISO time; used to settle sync between devices
}

export interface AppState {
  schema: 1;
  onboarded: boolean;
  prefs: { theme: Theme; textSize: number; leading: number; scriptureFont: ScriptureFont; version: VersionId };
  goals: Goal[];
  reads: ChapterRead[];
  position: Position | null;
  plan: { slug: string; startedOn: ISODate } | null;
  notes: Note[];
  highlights: Highlight[];
  contextSeen: Record<string, ISODate>; // book code -> last date the card was shown
  /**
   * Reading the Bible through again. Read marks and progress count only reads from
   * the current round; the streak and history use every read. null = the first round.
   */
  round: Round | null;
  /** When prefs, onboarding, plan or round last changed (ISO time), so account sync knows which side is newer. */
  settingsAt?: string;
}

const KEY = "lampstand:v1";

export const DEFAULT_STATE: AppState = {
  schema: 1,
  onboarded: false,
  prefs: { theme: "system", textSize: 19, leading: 1.78, scriptureFont: "serif", version: "KJV" },
  goals: [],
  reads: [],
  position: null,
  plan: null,
  notes: [],
  highlights: [],
  contextSeen: {},
  round: null,
};

export interface Round {
  number: number; // 2 for the second time through
  startedAt: string; // ISO time
}

export const TOTAL_CHAPTERS = BOOKS.reduce((n, b) => n + b.chapters, 0);

let state: AppState = DEFAULT_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppState>;
      state = { ...DEFAULT_STATE, ...saved, prefs: { ...DEFAULT_STATE.prefs, ...saved.prefs } };
    }
  } catch {
    // Private mode or blocked storage: run in memory.
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore; the session still works in memory.
  }
}

export function getState(): AppState {
  load();
  return state;
}

export function update(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  persist();
  listeners.forEach((l) => l());
}

/** Called after every change made on this device (account sync uses it). */
export function onChange(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(getState()),
    () => select(DEFAULT_STATE),
  );
}

/** False during server render and the first client render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ---- Selectors -------------------------------------------------------------

export function goalOn(goals: Goal[], date: ISODate): number {
  let goal = 1;
  for (const g of [...goals].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) {
    if (g.effectiveFrom <= date) goal = g.chaptersPerDay;
  }
  return goal;
}

export function currentGoal(goals: Goal[]): number {
  return goalOn(goals, today());
}

/** Reads that count toward the current round. */
export function roundReads(reads: ChapterRead[], round: Round | null): ChapterRead[] {
  return round ? reads.filter((r) => r.completedAt >= round.startedAt) : reads;
}

/** Different chapters read in the current round, out of TOTAL_CHAPTERS. */
export function chaptersReadInRound(reads: ChapterRead[], round: Round | null): number {
  return new Set(roundReads(reads, round).map((r) => `${r.book}.${r.chapter}`)).size;
}

export function useRoundReads(): ChapterRead[] {
  const reads = useStore((s) => s.reads);
  const round = useStore((s) => s.round);
  return useMemo(() => roundReads(reads, round), [reads, round]);
}

export function readsPerDay(reads: ChapterRead[]): Record<ISODate, number> {
  const out: Record<ISODate, number> = {};
  for (const r of reads) out[r.readOn] = (out[r.readOn] ?? 0) + 1;
  return out;
}

export function today(): ISODate {
  return toISODate(new Date());
}

// ---- Actions ---------------------------------------------------------------

export function setGoal(chaptersPerDay: number) {
  const date = today();
  update((s) => ({
    ...s,
    goals: [...s.goals.filter((g) => g.effectiveFrom !== date), { chaptersPerDay, effectiveFrom: date }],
  }));
}

export function markRead(ref: ChapterRef, version: VersionId) {
  const date = today();
  update((s) => {
    if (s.reads.some((r) => r.book === ref.book && r.chapter === ref.chapter && r.readOn === date)) return s;
    return {
      ...s,
      reads: [...s.reads, { ...ref, version, readOn: date, completedAt: new Date().toISOString() }],
    };
  });
}

/** Start reading the Bible through again from Genesis 1. Keeps the streak, notes, highlights and history. */
export function startNewRound() {
  update((s) => ({
    ...s,
    round: { number: (s.round?.number ?? 1) + 1, startedAt: new Date().toISOString() },
    position: { book: "GEN", chapter: 1, verse: 1, version: s.prefs.version, updatedAt: new Date().toISOString() },
    contextSeen: {},
    ...touched(),
  }));
}

export function setPosition(position: Position) {
  update((s) => ({ ...s, position: { ...position, updatedAt: new Date().toISOString() } }));
}

const touched = () => ({ settingsAt: new Date().toISOString() });

export function startPlan(slug: string | null) {
  update((s) => ({ ...s, plan: slug ? { slug, startedOn: today() } : null, ...touched() }));
}

export function setPrefs(prefs: Partial<AppState["prefs"]>) {
  update((s) => ({ ...s, prefs: { ...s.prefs, ...prefs }, ...touched() }));
}

export function completeOnboarding() {
  update((s) => ({ ...s, onboarded: true, ...touched() }));
}

export function markContextSeen(book: string) {
  update((s) => ({ ...s, contextSeen: { ...s.contextSeen, [book]: today() } }));
}

export function saveNote(note: Omit<Note, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const now = new Date().toISOString();
  update((s) => {
    if (note.id) {
      return {
        ...s,
        notes: s.notes.map((n) => (n.id === note.id ? { ...n, ...note, id: n.id, updatedAt: now } : n)),
      };
    }
    return { ...s, notes: [...s.notes, { ...note, id: crypto.randomUUID(), createdAt: now, updatedAt: now }] };
  });
}

export function deleteNote(id: string) {
  update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
}

/** One color per verse; the same color again removes it. */
export function toggleHighlight(ref: ChapterRef, verse: number, color: HighlightColor) {
  update((s) => {
    const at = (h: Highlight) => h.book === ref.book && h.chapter === ref.chapter && h.verseStart === verse;
    const existing = s.highlights.find(at);
    const rest = s.highlights.filter((h) => !at(h));
    if (existing?.color === color) return { ...s, highlights: rest };
    const h: Highlight = { id: crypto.randomUUID(), ...ref, verseStart: verse, verseEnd: verse, color, createdAt: new Date().toISOString() };
    return { ...s, highlights: [...rest, h] };
  });
}
