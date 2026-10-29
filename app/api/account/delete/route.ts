import { supabaseAdmin } from "@/lib/supabase/admin";
import { caller, fail } from "@/lib/lamplighters/server";

// Deletes the signed-in person's account and everything in it. Every table references
// auth.users "on delete cascade"; Circles they owned pass to the next member
// (public.lamp_after_member_leaves), and their messages and nudges go with them.

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return fail("sign_in_required", 401);
  const admin = supabaseAdmin();
  if (!admin) return fail("not_set_up", 503);
  const { error } = await admin.auth.admin.deleteUser(who.user.id);
  if (error) {
    console.error("Account delete failed", error);
    return fail("unknown", 500);
  }
  return Response.json({ ok: true });
}
