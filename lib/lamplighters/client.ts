"use client";

// Lamplighters from the browser. Reads and most writes go straight to Supabase, where
// row-level security and the functions in supabase/migrations/0005 enforce every rule;
// invites, nudges and chat messages (they may send email) and deleting an account go
// through /api.

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import type { ShareLevel } from "./config";

// ---- Errors ---------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  sign_in_required: "Sign in to use Circles.",
  not_a_member: "You're not in this Circle.",
  name_required: "Give it a name.",
  bad_email: "Enter an email address like name@example.com.",
  already_member: "They're already in this Circle.",
  circle_full: "This Circle is full.",
  invite_invalid: "This invite link doesn't work anymore. Ask for a new one.",
  invite_used: "This invite has already been used.",
  invite_expired: "This invite has expired. Ask your friend to send a new one.",
  invite_wrong_email: "This invite was sent to a different email. Sign in with that one.",
  already_nudged: "You've already nudged them today.",
  already_read: "They've already read today. Their lamp is lit!",
  nobody_to_nudge: "Everyone has read today or already has a nudge from you.",
  nudge_self: "You can't nudge yourself, but you can go read!",
  message_required: "Write something first.",
  not_allowed: "You can't do that here.",
  "rate_limited:nudge": "You've sent 3 nudges today. You can send more tomorrow.",
  "rate_limited:invite": "That's a lot of invites for one day. Try again tomorrow.",
  "rate_limited:create_circle": "That's a lot of new Circles for one day. Try again tomorrow.",
  "rate_limited:message_minute": "Slow down a little. Try again in a minute.",
  "rate_limited:message_day": "That's the most messages for one day. More tomorrow.",
  "rate_limited:report": "Thanks, we already have your reports for today.",
  highlight_not_saved: "This highlight isn't saved to your account yet. Try again in a moment.",
  bad_highlight: "Only your own highlights can be shared.",
};

export class LampError extends Error {}

/** A friendly sentence for a database or network error. */
export function friendly(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  const code = raw.match(/^[a-z_]+(:[a-z_]+)?/)?.[0] ?? "";
  if (MESSAGES[code]) return MESSAGES[code];
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Try again when you're back.";
  return "Something went wrong. Try again in a moment.";
}

function db() {
  const client = supabase();
  if (!client) throw new LampError("sign_in_required");
  return client;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new LampError(error.message);
  return data as T;
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new LampError("sign_in_required");
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new LampError(json.error ?? "unknown");
  return json;
}

// ---- Data that refreshes ------------------------------------------------------------

/**
 * Loads data and reloads it on `reload()` or when `deps` change. `data` stays while
 * reloading so screens don't flash.
 */
export function useLoad<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!load) return;
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show loading for a new load
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e) => live && setState((s) => ({ ...s, error: friendly(e), loading: false })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, !!load]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

/** Bumped after any change that other screens show (nudges read, Circles joined). */
let version = 0;
const versionListeners = new Set<() => void>();
export function changed() {
  version++;
  versionListeners.forEach((l) => l());
}
/** Called after any such change (outside React). */
export function onLampChange(l: () => void) {
  versionListeners.add(l);
  return () => {
    versionListeners.delete(l);
  };
}
export function useLampVersion() {
  return useSyncExternalStore(
    (l) => {
      versionListeners.add(l);
      return () => versionListeners.delete(l);
    },
    () => version,
    () => 0,
  );
}

// ---- Profile ----------------------------------------------------------------------

export interface LampProfile {
  display_name: string | null;
  avatar_id: string | null;
  share_level: ShareLevel;
  nudge_email: boolean;
  /** Email me Circle chat messages (supabase/migrations/0006). */
  message_email: boolean;
  show_email: boolean;
}

export async function getProfile(userId: string): Promise<LampProfile> {
  // "*" so a server without migration 0006 (no message_email yet) still loads.
  const { data, error } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new LampError(error.message);
  const p = (data ?? {}) as Partial<LampProfile>;
  return {
    display_name: p.display_name ?? null,
    avatar_id: p.avatar_id ?? null,
    share_level: p.share_level ?? "none",
    nudge_email: p.nudge_email === true,
    message_email: p.message_email === true,
    show_email: p.show_email === true,
  };
}

export async function updateProfile(userId: string, patch: Partial<LampProfile>) {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
  if (error) throw new LampError(error.message);
  changed();
}

/** The signed-in person's Lamplighters profile; null while loading or signed out. */
export function useLampProfile() {
  const sync = useSyncStatus();
  const v = useLampVersion();
  const res = useLoad(sync.userId ? () => getProfile(sync.userId!) : null, [sync.userId, v]);
  return { ...res, userId: sync.userId, ready: sync.ready };
}

// ---- Circles ----------------------------------------------------------------------

export interface CircleSummary {
  id: string;
  name: string;
  description: string | null;
  kind: "pair" | "circle";
  my_role: "owner" | "member";
  member_count: number;
  lit_count: number;
  unread_count: number;
  avatars: string[];
}

export interface Person {
  user_id: string;
  display_name: string;
  avatar_id: string | null;
  role: "owner" | "member";
  joined_at: string;
  read_today: boolean;
  streak: number | null;
  chapters_week: number | null;
  email: string | null;
  is_me: boolean;
}

export const myCircles = () => rpc<CircleSummary[]>("my_circles");
export const circlePeople = (circleId: string) => rpc<Person[]>("circle_people", { p_circle: circleId });

export async function getCircle(circleId: string) {
  const { data, error } = await db().from("circles").select("id, name, description, kind, max_members").eq("id", circleId).maybeSingle();
  if (error) throw new LampError(error.message);
  if (!data) throw new LampError("not_a_member");
  return data as { id: string; name: string; description: string | null; kind: "pair" | "circle"; max_members: number };
}

export async function createCircle(name: string, description: string, kind: "pair" | "circle") {
  const id = await rpc<string>("create_circle", { p_name: name, p_description: description || null, p_kind: kind });
  changed();
  return id;
}

export async function renameCircle(circleId: string, name: string, description: string) {
  const { error } = await db().from("circles").update({ name: name.trim(), description: description.trim() || null }).eq("id", circleId);
  if (error) throw new LampError(error.message);
  changed();
}

/** Leave (yourself) or remove (owner) a member. */
export async function removeMember(circleId: string, userId: string) {
  const { data, error } = await db().from("circle_members").delete().eq("circle_id", circleId).eq("user_id", userId).select("user_id");
  if (error) throw new LampError(error.message);
  if (!data?.length) throw new LampError("not_allowed");
  changed();
}

// ---- Invites ----------------------------------------------------------------------

export interface Invite {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  sent_at: string;
}

export async function myInvites(circleId: string): Promise<Invite[]> {
  const { data, error } = await db()
    .from("invites")
    .select("id, email, status, expires_at, sent_at")
    .eq("circle_id", circleId)
    .eq("status", "pending")
    .order("sent_at", { ascending: false });
  if (error) throw new LampError(error.message);
  return data as Invite[];
}

export interface InviteResult {
  link: string;
  emailed: boolean;
  email: string;
}

export const sendInvite = (circleId: string, email: string) => api<InviteResult>("/api/lamplighters/invite", { circleId, email });
export const resendInvite = (inviteId: string) => api<InviteResult>("/api/lamplighters/invite", { inviteId });
export const revokeInvite = (inviteId: string) => rpc<void>("revoke_invite", { p_invite: inviteId });

export const invitePreview = async (token: string) =>
  (await rpc<{ circle_name: string; inviter_name: string; email_hint: string; status: "pending" | "accepted" | "revoked" | "expired" }[]>("invite_preview", { p_token: token }))[0] ?? null;

export async function acceptInvite(token: string) {
  const id = await rpc<string>("accept_invite", { p_token: token });
  changed();
  return id;
}

// ---- Nudges -----------------------------------------------------------------------

export interface Nudge {
  id: string;
  circle_id: string;
  circle_name: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  to_circle: boolean;
  message: string;
  note: string | null;
  created_at: string;
  read_at: string | null;
}

export const sendNudge = (circleId: string, recipientId: string | null, message: string, note: string) =>
  api<{ sent: number }>("/api/lamplighters/nudge", { circleId, recipientId, message, note });

/** Nudges sent to me, newest first: 30 unless asked for more (the database allows 100). */
export const myNudges = (limit = 30) => rpc<Nudge[]>("my_nudges", { p_limit: limit });

export async function markNudgesRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await db().from("nudges").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) throw new LampError(error.message);
  changed();
}

export interface Mute {
  muted_user_id: string | null;
  muted_circle_id: string | null;
}

export async function myMutes(): Promise<Mute[]> {
  const { data, error } = await db().from("nudge_mutes").select("muted_user_id, muted_circle_id");
  if (error) throw new LampError(error.message);
  return data as Mute[];
}

export async function setMute(userId: string, target: { user: string } | { circle: string }, muted: boolean) {
  const col = "user" in target ? "muted_user_id" : "muted_circle_id";
  const value = "user" in target ? target.user : target.circle;
  const q = muted
    ? db().from("nudge_mutes").insert({ user_id: userId, [col]: value })
    : db().from("nudge_mutes").delete().eq("user_id", userId).eq(col, value);
  const { error } = await q;
  if (error && error.code !== "23505") throw new LampError(error.message); // already muted is fine
  changed();
}

// ---- Notifications ------------------------------------------------------------------

/** One chat message or nudge that reached me (supabase/migrations/0006). */
export interface LampNotification {
  id: string;
  kind: "message" | "nudge";
  circle_id: string;
  circle_name: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  message_id: string | null;
  nudge_id: string | null;
  /** The message text, or the nudge line. Null for a shared verse with no text. */
  body: string | null;
  verse_ref: string | null;
  note: string | null;
  to_circle: boolean;
  created_at: string;
  read_at: string | null;
}

export const myNotifications = () => rpc<LampNotification[]>("my_notifications", { p_limit: 50 });

/** Marks them read; a nudge's notification marks the nudge read too (in the database). */
export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await db().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) throw new LampError(error.message);
  changed();
}

// ---- Activity and reactions ---------------------------------------------------------

export interface Activity {
  id: string;
  actor_id: string | null;
  kind: "chapter" | "milestone" | "nudge" | "joined";
  data: { book?: string; chapter?: number; type?: "chapters" | "streak" | "book"; value?: number; to?: string | null };
  created_at: string;
  reactions: { emoji: string; user_id: string }[];
}

export async function circleActivity(circleId: string): Promise<Activity[]> {
  const { data, error } = await db()
    .from("activity")
    .select("id, actor_id, kind, data, created_at, reactions(emoji, user_id)")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new LampError(error.message);
  return data as Activity[];
}

export async function react(activityId: string, userId: string, emoji: string, on: boolean) {
  const q = on
    ? db().from("reactions").insert({ activity_id: activityId, user_id: userId, emoji })
    : db().from("reactions").delete().eq("activity_id", activityId).eq("user_id", userId).eq("emoji", emoji);
  const { error } = await q;
  if (error && error.code !== "23505") throw new LampError(error.message);
}

/** Posts a chapter or milestone to my Circles, if my sharing choice allows. Never throws. */
export function shareProgress(kind: "chapter" | "milestone", data: Record<string, string | number>) {
  const client = supabase();
  if (!client) return;
  client.auth
    .getSession() // read from this device; guests have none, so nothing is sent
    .then(({ data: s }) => s.session && rpc("share_progress", { p_kind: kind, p_data: data }))
    .catch(() => {});
}

// ---- Chat -------------------------------------------------------------------------

/** A highlight shared to a Circle (supabase/migrations/0011). The words are KJV. */
export interface SharedHighlight {
  ref: string;
  text: string;
  color: "gold" | "sky" | "sage" | "rose";
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  /** Included only when the sharer chose to. Written by AI. */
  summary?: string;
}

export interface Message {
  id: string;
  circle_id: string;
  sender_id: string;
  body: string | null;
  verse: { ref: string; text: string } | null;
  highlight?: SharedHighlight | null;
  created_at: string;
  deleted_at: string | null;
}

const BASE_COLUMNS = "id, circle_id, sender_id, body, verse, created_at, deleted_at";
// Shared highlights need migration 0011. Until it's run, chat works without them.
let highlightColumn = true;
const messageColumns = () => (highlightColumn ? `${BASE_COLUMNS}, highlight` : BASE_COLUMNS);
const missingHighlight = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42703" || /highlight/.test(e.message ?? ""));

/** Runs a messages query, and again without the highlight column if the server doesn't have it yet. */
async function withColumns<T>(run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string; message: string } | null }>): Promise<T | null> {
  let { data, error } = await run(messageColumns());
  if (error && highlightColumn && missingHighlight(error)) {
    highlightColumn = false;
    ({ data, error } = await run(messageColumns()));
  }
  if (error) throw new LampError(error.message);
  return data;
}

/** A page of messages, newest first, from before `before` (ISO time). */
export async function messagesBefore(circleId: string, before: string | null, limit: number): Promise<Message[]> {
  const data = await withColumns<Message[]>((columns) => {
    let q = db().from("messages").select(columns).eq("circle_id", circleId).order("created_at", { ascending: false }).limit(limit);
    if (before) q = q.lt("created_at", before);
    return q.returns<Message[]>();
  });
  return data ?? [];
}

export async function getMessage(id: string): Promise<Message | null> {
  return withColumns<Message>((columns) => db().from("messages").select(columns).eq("id", id).maybeSingle<Message>()).catch(() => null);
}

/** Highlights shared in a Circle, newest first. */
export async function circleShares(circleId: string, limit = 20): Promise<Message[]> {
  if (!highlightColumn) return [];
  const { data, error } = await db()
    .from("messages")
    .select(messageColumns())
    .eq("circle_id", circleId)
    .not("highlight", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Message[]>();
  if (error) {
    if (missingHighlight(error)) return [];
    throw new LampError(error.message);
  }
  return data ?? [];
}

// ---- Sharing highlights -------------------------------------------------------------

export interface ShareResult {
  shared: string[];
  already: string[];
  failed: Record<string, string>;
}

/** Shares my highlight (already saved to my account) to these Circles. */
export const shareHighlight = (highlightId: string, circleIds: string[], note: string, withSummary: boolean) =>
  api<ShareResult>("/api/lamplighters/share", { highlightId, circleIds, note, withSummary });

/** The Circles that get my new highlights automatically, with when each was turned on. */
export async function myAutoShare(): Promise<{ circle_id: string; created_at: string }[]> {
  const { data, error } = await db().from("highlight_auto_share").select("circle_id, created_at");
  if (error) throw new LampError(error.message);
  return data as { circle_id: string; created_at: string }[];
}

export async function setAutoShare(userId: string, circleId: string, on: boolean) {
  const q = on
    ? db().from("highlight_auto_share").insert({ user_id: userId, circle_id: circleId })
    : db().from("highlight_auto_share").delete().eq("user_id", userId).eq("circle_id", circleId);
  const { error } = await q;
  if (error && error.code !== "23505") throw new LampError(error.message);
  changed();
}

/**
 * Posts through the server, which notifies the other members and emails those who
 * asked. `id` is chosen here: sending again with the same id (a retry) never posts twice.
 */
export const sendMessage = (id: string, circleId: string, body: string, verse: Message["verse"] = null) =>
  api<Message>("/api/lamplighters/message", { id, circleId, body, verse });

export const deleteMessage = (id: string) => rpc<void>("delete_message", { p_message: id });
export const reportMessage = (id: string, reason: string) => rpc<void>("report_message", { p_message: id, p_reason: reason || null });

/** Where I'd read up to in this Circle's chat, before opening it now (null: never opened). */
export async function lastReadAt(circleId: string, userId: string): Promise<string | null> {
  const { data } = await db().from("circle_members").select("last_read_message_at").eq("circle_id", circleId).eq("user_id", userId).maybeSingle();
  return (data as { last_read_message_at: string } | null)?.last_read_message_at ?? null;
}

// Back from a chat: return to the Circles list the way the browser would (so the phone's
// back gesture and the Back button agree), unless the chat was opened from a link.
// A time, not a flag that's used up: React may call a state initializer twice in development.
let fromCirclesAt = 0;
/** Called when a chat is opened from the Circles list or its notifications. */
export const cameFromCircles = () => {
  fromCirclesAt = Date.now();
};
/** True when the chat was just opened from inside the app's Circles screens. */
export const openedFromCircles = () => Date.now() - fromCirclesAt < 5000;

export async function markChatRead(circleId: string, userId: string) {
  await db().from("circle_members").update({ last_read_message_at: new Date().toISOString() }).eq("circle_id", circleId).eq("user_id", userId);
  changed();
}

export async function myBlocks(): Promise<string[]> {
  const { data, error } = await db().from("blocks").select("blocked_id");
  if (error) throw new LampError(error.message);
  return (data as { blocked_id: string }[]).map((b) => b.blocked_id);
}

export async function setBlocked(userId: string, blockedId: string, blocked: boolean) {
  const q = blocked
    ? db().from("blocks").insert({ blocker_id: userId, blocked_id: blockedId })
    : db().from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", blockedId);
  const { error } = await q;
  if (error && error.code !== "23505") throw new LampError(error.message);
  changed();
}

// ---- Account ----------------------------------------------------------------------

export const deleteAccount = () => api<{ ok: true }>("/api/account/delete", {});
