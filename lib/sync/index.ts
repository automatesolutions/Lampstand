"use client";

// Account sync. The on-device store stays the source the app reads from; when the
// reader is signed in, this pulls the account's data, merges it in (lib/sync/merge),
// and uploads whatever the account is missing — on sign-in, on opening the app, when
// the tab comes back into view, and a couple of seconds after any change.

import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getState, onChange, update, type AppState, type HighlightColor } from "@/lib/store";
import type { VersionId } from "@/lib/bible/types";
import { changesToPush, mergeState, type Remote } from "./merge";

export interface SyncStatus {
  ready: boolean; // the session check has finished
  email: string | null;
  syncing: boolean;
  lastSynced: string | null; // ISO time
  error: string | null;
}

const INITIAL: SyncStatus = { ready: false, email: null, syncing: false, lastSynced: null, error: null };
let status: SyncStatus = INITIAL;
const listeners = new Set<() => void>();
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => INITIAL, // server render and hydration always start signed out
  );
}

let userId: string | null = null;
let known: Remote | null = null; // what the account holds, as far as this device knows
let applying = false; // true while writing merged data into the store
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPull = 0;
let running: Promise<void> | null = null;

const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : undefined);

/** Supabase returns at most 1,000 rows per request. */
async function all<T>(db: SupabaseClient, table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

type Row = Record<string, unknown>;

async function pull(db: SupabaseClient): Promise<Remote> {
  const [profile, goals, position, reads, notes, highlights, deletions] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId!).maybeSingle(),
    all<Row>(db, "daily_goals", "chapters_per_day, effective_from"),
    db.from("reading_position").select("*").eq("user_id", userId!).maybeSingle(),
    all<Row>(db, "chapter_reads", "book, chapter, version, read_on, completed_at"),
    all<Row>(db, "notes", "id, book, chapter, verse_start, verse_end, body, created_at, updated_at"),
    all<Row>(db, "highlights", "id, book, chapter, verse_start, verse_end, color, created_at"),
    all<Row>(db, "deletions", "kind, item_id"),
  ]);
  if (profile.error) throw profile.error;
  if (position.error) throw position.error;
  const p = profile.data as Row | null;
  const pos = position.data as Row | null;

  return {
    reads: reads.map((r) => ({ book: String(r.book), chapter: Number(r.chapter), version: r.version as VersionId, readOn: String(r.read_on), completedAt: iso(r.completed_at as string)! })),
    goals: goals.map((g) => ({ chaptersPerDay: Number(g.chapters_per_day), effectiveFrom: String(g.effective_from) })),
    notes: notes.map((n) => ({
      id: String(n.id),
      book: String(n.book),
      chapter: Number(n.chapter),
      verseStart: n.verse_start == null ? null : Number(n.verse_start),
      verseEnd: n.verse_end == null ? null : Number(n.verse_end),
      body: String(n.body),
      createdAt: iso(n.created_at as string)!,
      updatedAt: iso(n.updated_at as string)!,
    })),
    highlights: highlights.map((h) => ({
      id: String(h.id),
      book: String(h.book),
      chapter: Number(h.chapter),
      verseStart: Number(h.verse_start),
      verseEnd: Number(h.verse_end),
      color: h.color as HighlightColor,
      createdAt: iso(h.created_at as string)!,
    })),
    position: pos ? { book: String(pos.book), chapter: Number(pos.chapter), verse: Number(pos.verse), version: pos.version as VersionId, updatedAt: iso(pos.updated_at as string) } : null,
    settings:
      p && p.updated_at
        ? {
            prefs: {
              version: p.preferred_version as VersionId,
              theme: p.theme as AppState["prefs"]["theme"],
              textSize: Number(p.text_size),
              leading: Number(p.line_spacing),
              scriptureFont: p.scripture_font as AppState["prefs"]["scriptureFont"],
            },
            onboarded: Boolean(p.onboarded),
            plan: p.plan_slug ? { slug: String(p.plan_slug), startedOn: String(p.plan_started_on) } : null,
            round: p.round_started_at ? { number: Number(p.round_number), startedAt: iso(p.round_started_at as string)! } : null,
            settingsAt: iso(p.updated_at as string)!,
          }
        : null,
    deleted: {
      notes: new Set(deletions.filter((d) => d.kind === "note").map((d) => String(d.item_id))),
      highlights: new Set(deletions.filter((d) => d.kind === "highlight").map((d) => String(d.item_id))),
    },
  };
}

async function upsert(db: SupabaseClient, table: string, rows: Row[], onConflict: string, ignoreDuplicates = false) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict, ignoreDuplicates });
    if (error) throw error;
  }
}

async function push(db: SupabaseClient) {
  if (!known || !userId) return;
  const local = getState();
  const c = changesToPush(local, known);
  const user_id = userId;

  if (c.deletedNotes.length || c.deletedHighlights.length) {
    const tombs = [...c.deletedNotes.map((id) => ({ user_id, kind: "note", item_id: id })), ...c.deletedHighlights.map((id) => ({ user_id, kind: "highlight", item_id: id }))];
    await upsert(db, "deletions", tombs, "user_id,kind,item_id", true);
    if (c.deletedNotes.length) await db.from("notes").delete().in("id", c.deletedNotes);
    if (c.deletedHighlights.length) await db.from("highlights").delete().in("id", c.deletedHighlights);
  }
  await upsert(db, "chapter_reads", c.reads.map((r) => ({ user_id, book: r.book, chapter: r.chapter, version: r.version, read_on: r.readOn, completed_at: r.completedAt })), "user_id,book,chapter,read_on", true);
  await upsert(db, "daily_goals", c.goals.map((g) => ({ user_id, chapters_per_day: g.chaptersPerDay, effective_from: g.effectiveFrom })), "user_id,effective_from");
  await upsert(db, "notes", c.notes.map((n) => ({ id: n.id, user_id, book: n.book, chapter: n.chapter, verse_start: n.verseStart, verse_end: n.verseEnd, body: n.body, created_at: n.createdAt, updated_at: n.updatedAt })), "id");
  await upsert(db, "highlights", c.highlights.map((h) => ({ id: h.id, user_id, book: h.book, chapter: h.chapter, verse_start: h.verseStart, verse_end: h.verseEnd, color: h.color, created_at: h.createdAt })), "user_id,book,chapter,verse_start");
  if (c.position) {
    const p = c.position;
    await upsert(db, "reading_position", [{ user_id, book: p.book, chapter: p.chapter, verse: p.verse, version: p.version, updated_at: p.updatedAt ?? new Date().toISOString() }], "user_id");
  }
  const settingsAt = local.settingsAt ?? "1970-01-01T00:00:00.000Z"; // never changed here: any saved account settings win elsewhere
  if (c.settings || c.round || !known.settings) {
    const { prefs, plan, round } = local;
    await upsert(
      db,
      "profiles",
      [
        {
          id: user_id,
          preferred_version: prefs.version,
          theme: prefs.theme,
          text_size: prefs.textSize,
          line_spacing: prefs.leading,
          scripture_font: prefs.scriptureFont,
          onboarded: local.onboarded,
          plan_slug: plan?.slug ?? null,
          plan_started_on: plan?.startedOn ?? null,
          round_number: round?.number ?? 1,
          round_started_at: round?.startedAt ?? null,
          updated_at: settingsAt,
        },
      ],
      "id",
    );
  }

  // The account now matches this device.
  known = {
    ...known,
    reads: [...known.reads, ...c.reads],
    goals: local.goals,
    notes: local.notes,
    highlights: local.highlights,
    position: local.position,
    settings: { prefs: local.prefs, onboarded: local.onboarded, plan: local.plan, round: local.round, settingsAt },
  };
}

async function syncNow(force = false) {
  const db = supabase();
  if (!db || !userId) return;
  if (running) return running;
  if (!force && Date.now() - lastPull < 60_000) {
    running = push(db).finally(() => (running = null));
    return running;
  }
  setStatus({ syncing: true, error: null });
  running = (async () => {
    try {
      const remote = await pull(db);
      lastPull = Date.now();
      known = remote;
      const merged = mergeState(getState(), remote);
      applying = true;
      update(() => merged);
      applying = false;
      await push(db);
      setStatus({ syncing: false, lastSynced: new Date().toISOString() });
    } catch (e) {
      applying = false;
      console.error("Sync failed", e);
      setStatus({ syncing: false, error: navigator.onLine ? "Couldn't sync just now. It will try again." : "You're offline. Changes will sync when you're back." });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Sync again a moment after the reader changes something. */
function schedulePush() {
  if (applying || !userId) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const db = supabase();
    if (!db) return;
    try {
      await (running ?? push(db));
      setStatus({ lastSynced: new Date().toISOString(), error: null });
    } catch (e) {
      console.error("Sync failed", e);
      setStatus({ error: "Couldn't save to your account just now. It will try again." });
    }
  }, 2000);
}

let started = false;

/** Starts sync for this browser tab (once). */
export function startSync() {
  const db = supabase();
  if (started || !db) {
    if (!db) setStatus({ ready: true });
    return;
  }
  started = true;
  onChange(schedulePush);
  const onVisible = () => {
    if (document.visibilityState === "visible") syncNow();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", () => syncNow(true));

  db.auth.onAuthStateChange((event, session) => {
    const id = session?.user.id ?? null;
    const changed = id !== userId;
    userId = id;
    setStatus({ ready: true, email: session?.user.email ?? null });
    if (!id) {
      known = null;
      return;
    }
    // Run outside the auth callback, as Supabase recommends.
    if (changed || event === "SIGNED_IN") setTimeout(() => syncNow(true), 0);
  });
}

export async function sendSignInLink(email: string): Promise<string | null> {
  const db = supabase();
  if (!db) return "Accounts aren't set up on this server yet.";
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: true } });
  if (!error) return null;
  if (error.status === 429) return "Too many sign-in emails just now. Wait a few minutes and try again.";
  return error.message || "That email couldn't be sent. Check the address and try again.";
}

export async function signOut() {
  await supabase()?.auth.signOut();
  known = null;
  userId = null;
  setStatus({ email: null, lastSynced: null, error: null });
}

export { syncNow };
