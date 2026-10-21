import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { costUsd, type Usage } from "./cost";

// Daily spending cap for the Claude API (Pray and Explain). Totals are kept in
// Supabase (ai_usage) so every Cloud Run instance shares them; without the
// secret key it falls back to this instance's memory, which is weaker but safe.
// Set DAILY_AI_BUDGET_USD to change the cap (default $2 a day, UTC).

export type Feature = "prayer" | "explain";

const budget = () => {
  const n = Number(process.env.DAILY_AI_BUDGET_USD ?? 2);
  return Number.isFinite(n) && n >= 0 ? n : 2;
};
const today = () => new Date().toISOString().slice(0, 10);

let memory = { day: today(), spent: 0 };
// Last known shared total, so most requests don't wait on the database.
let shared = { day: "", spent: 0, at: 0 };

function memorySpent() {
  if (memory.day !== today()) memory = { day: today(), spent: 0 };
  return memory.spent;
}

/** Today's spend in US$ (all features). */
export async function spentToday(): Promise<number> {
  const db = supabaseAdmin();
  if (!db) return memorySpent();
  if (shared.day === today() && Date.now() - shared.at < 20_000) return shared.spent;
  const { data, error } = await db.from("ai_usage").select("cost_usd").eq("day", today());
  if (error) {
    console.error("ai_usage read failed", error.message);
    return Math.max(memorySpent(), shared.day === today() ? shared.spent : 0);
  }
  const spent = (data ?? []).reduce((n, r) => n + Number(r.cost_usd), 0);
  shared = { day: today(), spent, at: Date.now() };
  return spent;
}

/** True when today's cap is used up: the feature should pause until tomorrow. */
export async function overBudget(): Promise<boolean> {
  return (await spentToday()) >= budget();
}

/** Adds a finished request's cost to today's total. Never throws. */
export async function recordUsage(feature: Feature, model: string, usage: Usage): Promise<void> {
  const cost = costUsd(model, usage);
  memorySpent();
  memory.spent += cost;
  const db = supabaseAdmin();
  if (!db) return;
  const { data, error } = await db.rpc("record_ai_usage", { p_feature: feature, p_cost: Number(cost.toFixed(4)) });
  if (error) console.error("ai_usage write failed", error.message);
  else shared = { day: today(), spent: Number(data), at: Date.now() };
}

export const budgetReached = (what: string) =>
  Response.json({ error: `${what} is resting for today because it has reached its daily limit. Please try again tomorrow.` }, { status: 503 });
