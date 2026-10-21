"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One browser client. The URL and publishable key are public by design; every
// table is protected by row-level security (supabase/migrations).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/** null when accounts aren't set up (no Supabase keys). */
export function supabase(): SupabaseClient | null {
  if (!url || !key || typeof window === "undefined") return null;
  client ??= createBrowserClient(url, key);
  return client;
}

export const accountsEnabled = Boolean(url && key);
