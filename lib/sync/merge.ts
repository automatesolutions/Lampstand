// Merging this device's data with the account's (pure, so it can be tested).
// Rules: reads, goals, notes and highlights are unions; for the same item the newer
// copy wins; deletions remove items everywhere; settings, position and the reading
// round take the newer side.

import type { AppState, ChapterRead, Goal, Highlight, Note, Position, Round } from "@/lib/store";

export interface Remote {
  reads: ChapterRead[];
  goals: Goal[];
  notes: Note[];
  highlights: Highlight[];
  position: Position | null;
  /** null when the account has never saved settings. */
  settings: (Pick<AppState, "prefs" | "onboarded" | "plan" | "round"> & { settingsAt: string }) | null;
  deleted: { notes: Set<string>; highlights: Set<string> };
}

export const readKey = (r: Pick<ChapterRead, "book" | "chapter" | "readOn">) => `${r.book}.${r.chapter}.${r.readOn}`;
export const highlightKey = (h: Pick<Highlight, "book" | "chapter" | "verseStart">) => `${h.book}.${h.chapter}.${h.verseStart}`;

function newer(a?: string, b?: string) {
  return (a ?? "") >= (b ?? "");
}

export function mergeState(local: AppState, remote: Remote): AppState {
  const reads = new Map<string, ChapterRead>();
  for (const r of [...remote.reads, ...local.reads]) {
    const k = readKey(r);
    const have = reads.get(k);
    if (!have || r.completedAt < have.completedAt) reads.set(k, r);
  }

  const goals = new Map<string, Goal>();
  for (const g of [...remote.goals, ...local.goals]) goals.set(g.effectiveFrom, g); // this device wins on the same day

  const notes = new Map<string, Note>();
  for (const n of [...remote.notes, ...local.notes]) {
    if (remote.deleted.notes.has(n.id)) continue;
    const have = notes.get(n.id);
    if (!have || newer(n.updatedAt, have.updatedAt)) notes.set(n.id, n);
  }

  const highlights = new Map<string, Highlight>();
  for (const h of [...remote.highlights, ...local.highlights]) {
    if (remote.deleted.highlights.has(h.id)) continue;
    const k = highlightKey(h);
    const have = highlights.get(k);
    if (!have || newer(h.createdAt, have.createdAt)) highlights.set(k, h);
  }

  const position = !remote.position ? local.position : !local.position ? remote.position : newer(local.position.updatedAt, remote.position.updatedAt) ? local.position : remote.position;

  const s = remote.settings;
  const settings = s && !newer(local.settingsAt, s.settingsAt) ? { prefs: s.prefs, onboarded: s.onboarded || local.onboarded, plan: s.plan, settingsAt: s.settingsAt } : {};

  return {
    ...local,
    ...settings,
    round: laterRound(local.round, s?.round ?? null),
    reads: [...reads.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt)),
    goals: [...goals.values()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
    notes: [...notes.values()],
    highlights: [...highlights.values()],
    position,
  };
}

/** Starting over on any device starts over everywhere: keep the most recent round. */
function laterRound(a: Round | null, b: Round | null): Round | null {
  if (!a) return b;
  if (!b) return a;
  return a.startedAt >= b.startedAt ? a : b;
}

/** What this device has that the account doesn't (or has older), to upload. */
export function changesToPush(local: AppState, known: Remote) {
  const knownReads = new Set(known.reads.map(readKey));
  const knownGoals = new Map(known.goals.map((g) => [g.effectiveFrom, g.chaptersPerDay]));
  const knownNotes = new Map(known.notes.map((n) => [n.id, n.updatedAt]));
  const knownHighlights = new Map(known.highlights.map((h) => [highlightKey(h), h]));
  const localNoteIds = new Set(local.notes.map((n) => n.id));
  const localHighlightIds = new Set(local.highlights.map((h) => h.id));

  return {
    reads: local.reads.filter((r) => !knownReads.has(readKey(r))),
    goals: local.goals.filter((g) => knownGoals.get(g.effectiveFrom) !== g.chaptersPerDay),
    notes: local.notes.filter((n) => knownNotes.get(n.id) !== n.updatedAt),
    highlights: local.highlights.filter((h) => {
      const k = knownHighlights.get(highlightKey(h));
      return !k || k.id !== h.id || k.color !== h.color;
    }),
    deletedNotes: known.notes.filter((n) => !localNoteIds.has(n.id)).map((n) => n.id),
    deletedHighlights: known.highlights.filter((h) => !localHighlightIds.has(h.id)).map((h) => h.id),
    position: local.position && (!known.position || local.position.updatedAt !== known.position.updatedAt) ? local.position : null,
    settings: !!local.settingsAt && local.settingsAt !== known.settings?.settingsAt,
    round: (local.round?.startedAt ?? null) !== (known.settings?.round?.startedAt ?? null),
  };
}
