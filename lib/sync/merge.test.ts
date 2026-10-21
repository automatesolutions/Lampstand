import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, type AppState, type Highlight, type Note } from "@/lib/store";
import { changesToPush, mergeState, type Remote } from "./merge";

const empty = (): Remote => ({ reads: [], goals: [], notes: [], highlights: [], position: null, settings: null, deleted: { notes: new Set(), highlights: new Set() } });
const read = (book: string, chapter: number, at: string) => ({ book, chapter, version: "KJV" as const, readOn: at.slice(0, 10), completedAt: at });
const note = (id: string, body: string, updatedAt: string): Note => ({ id, book: "JHN", chapter: 3, verseStart: 16, verseEnd: 16, body, createdAt: "2026-01-01T00:00:00Z", updatedAt });
const hl = (id: string, color: Highlight["color"], createdAt: string, verse = 16): Highlight => ({ id, book: "JHN", chapter: 3, verseStart: verse, verseEnd: verse, color, createdAt });

describe("mergeState", () => {
  it("joins reads from both sides without doubles", () => {
    const local: AppState = { ...DEFAULT_STATE, reads: [read("GEN", 1, "2026-10-01T08:00:00Z"), read("GEN", 2, "2026-10-02T08:00:00Z")] };
    const remote = { ...empty(), reads: [read("GEN", 1, "2026-10-01T09:00:00Z"), read("EXO", 1, "2026-09-01T08:00:00Z")] };
    const merged = mergeState(local, remote);
    expect(merged.reads.map((r) => `${r.book}${r.chapter}`)).toEqual(["EXO1", "GEN1", "GEN2"]);
  });

  it("keeps the newer copy of a note and drops deleted ones", () => {
    const local: AppState = { ...DEFAULT_STATE, notes: [note("a", "old", "2026-10-01T00:00:00Z"), note("b", "gone", "2026-10-01T00:00:00Z")] };
    const remote = { ...empty(), notes: [note("a", "new", "2026-10-05T00:00:00Z")], deleted: { notes: new Set(["b"]), highlights: new Set<string>() } };
    expect(mergeState(local, remote).notes.map((n) => n.body)).toEqual(["new"]);
  });

  it("keeps one highlight per verse, the newer one", () => {
    const local: AppState = { ...DEFAULT_STATE, highlights: [hl("x", "gold", "2026-10-01T00:00:00Z")] };
    const remote = { ...empty(), highlights: [hl("y", "rose", "2026-10-03T00:00:00Z"), hl("z", "sky", "2026-10-03T00:00:00Z", 17)] };
    expect(mergeState(local, remote).highlights.map((h) => `${h.verseStart}${h.color}`)).toEqual(["16rose", "17sky"]);
  });

  it("takes the newer settings and the latest reading round", () => {
    const local: AppState = { ...DEFAULT_STATE, settingsAt: "2026-10-01T00:00:00Z", round: { number: 2, startedAt: "2026-10-10T00:00:00Z" } };
    const remote = { ...empty(), settings: { prefs: { ...DEFAULT_STATE.prefs, textSize: 23 }, onboarded: true, plan: null, round: null, settingsAt: "2026-10-05T00:00:00Z" } };
    const merged = mergeState(local, remote);
    expect(merged.prefs.textSize).toBe(23);
    expect(merged.round?.number).toBe(2);
  });
});

describe("changesToPush", () => {
  it("lists what the account is missing and what was deleted here", () => {
    const known = { ...empty(), reads: [read("GEN", 1, "2026-10-01T08:00:00Z")], notes: [note("a", "x", "1"), note("b", "y", "1")] };
    const local: AppState = { ...DEFAULT_STATE, reads: [read("GEN", 1, "2026-10-01T08:00:00Z"), read("GEN", 2, "2026-10-02T08:00:00Z")], notes: [note("a", "x2", "2")] };
    const c = changesToPush(local, known);
    expect(c.reads.map((r) => r.chapter)).toEqual([2]);
    expect(c.notes.map((n) => n.id)).toEqual(["a"]);
    expect(c.deletedNotes).toEqual(["b"]);
  });
});
