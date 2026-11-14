import "server-only";
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, ipKey } from "./server";

// Daily limits for paid features, kept in Supabase (usage_counters, migration 0009) so
// every server instance shares them and a restart doesn't reset them. Each call names
// the feature and its limits ("this person 3, this address 6, the whole app 3"); either
// all of them have room and all are counted, or none is.
//
// Without the secret key, or if the database can't be reached, this instance counts in
// memory instead: weaker (per instance), but never unlimited.

export type Scope = "app" | "user" | "ip" | "key";

export interface Limit {
  scope: Scope;
  subject: string;
  max: number;
}

export interface Quota {
  /** Lowercase name, like "song" or "highlight". New features reuse the same table. */
  feature: string;
  limits: Limit[];
  /** Requests by default; characters, for example, for narration. */
  amount?: number;
}

/** Allowed (with a way to give the use back if the paid call fails), or which limit was full. */
export type QuotaResult = { ok: true; giveBack: () => Promise<void> } | { ok: false; full: Scope };

/** Network addresses are only ever stored as this keyed hash. */
function hashAddress(ip: string): string {
  const salt = process.env.USAGE_HASH_SECRET || `lampstand-usage:${process.env.SUPABASE_SECRET_KEY ?? ""}`;
  return createHmac("sha256", salt).update(ipKey(ip)).digest("base64url").slice(0, 32);
}

/** The limit for the address this request came from. */
export const ipLimit = (req: Request, max: number): Limit => ({ scope: "ip", subject: hashAddress(clientIp(req)), max });
export const userLimit = (userId: string, max: number): Limit => ({ scope: "user", subject: userId, max });
export const appLimit = (max: number): Limit => ({ scope: "app", subject: "all", max });

/** A whole number from an env var, or the default. */
export function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw == null || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

// ---- In-memory fallback ---------------------------------------------------------

const today = () => new Date().toISOString().slice(0, 10);
const MEMORY_MAX_KEYS = 50_000;
let memory = { day: today(), counts: new Map<string, number>() };
const memKey = (feature: string, l: Limit) => `${feature}|${l.scope}|${l.subject}`;

function memoryCounts() {
  if (memory.day !== today()) memory = { day: today(), counts: new Map() };
  return memory.counts;
}

function takeInMemory(q: Quota): QuotaResult {
  const { feature, limits, amount = 1 } = q;
  const counts = memoryCounts();
  // Too many people to track: refuse rather than forget anyone's count.
  if (counts.size > MEMORY_MAX_KEYS) return { ok: false, full: "app" };
  for (const l of limits) if ((counts.get(memKey(feature, l)) ?? 0) + amount > l.max) return { ok: false, full: l.scope };
  for (const l of limits) counts.set(memKey(feature, l), (counts.get(memKey(feature, l)) ?? 0) + amount);
  let given = false;
  return {
    ok: true,
    giveBack: async () => {
      if (!given) giveBackInMemory(q);
      given = true;
    },
  };
}

function giveBackInMemory({ feature, limits, amount = 1 }: Quota) {
  const counts = memoryCounts();
  for (const l of limits) {
    const k = memKey(feature, l);
    if (counts.has(k)) counts.set(k, Math.max(0, counts.get(k)! - amount));
  }
}

// ---- Shared limits --------------------------------------------------------------

const asChecks = (limits: Limit[]) => limits.map((l) => ({ scope: l.scope, subject: l.subject, max: l.max }));

/**
 * Counts one use (or `amount`) against every limit, if all have room. Never throws.
 * Call `giveBack()` on the result if the paid call then fails before it starts.
 */
export async function takeQuota(q: Quota): Promise<QuotaResult> {
  if (q.limits.some((l) => l.max <= 0)) return { ok: false, full: q.limits.find((l) => l.max <= 0)!.scope };
  const db = supabaseAdmin();
  if (!db) return takeInMemory(q);
  const { data, error } = await db.rpc("use_quota", { p_feature: q.feature, p_checks: asChecks(q.limits), p_amount: q.amount ?? 1 });
  if (error) {
    console.error("usage_counters failed; counting in memory", error.message);
    return takeInMemory(q);
  }
  if (data) return { ok: false, full: data as Scope };
  let given = false;
  return {
    ok: true,
    // Gives the use back when the paid call failed before it began. Once only; never throws.
    giveBack: async () => {
      if (given) return;
      given = true;
      const res = await db.rpc("release_quota", { p_feature: q.feature, p_checks: asChecks(q.limits), p_amount: q.amount ?? 1 });
      if (res.error) console.error("release_quota failed", res.error.message);
    },
  };
}

/** For tests. */
export function resetMemoryQuota() {
  memory = { day: today(), counts: new Map() };
}
