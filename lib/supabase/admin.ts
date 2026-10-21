import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client with the secret key. It bypasses row-level security,
// so it is used only for server-owned tables (ai_usage, explanations) and never
// reaches the browser. null when SUPABASE_SECRET_KEY isn't set.

let admin: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  admin = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}
