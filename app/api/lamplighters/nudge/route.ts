import { supabaseAdmin } from "@/lib/supabase/admin";
import { appUrl, caller, dbFail, fail, sendEmail } from "@/lib/lamplighters/server";

// Sends a nudge through public.send_nudge (which enforces every limit and mute), then
// emails the people who turned on nudge emails. Emails need the secret key, to look
// up addresses that members never see.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return fail("sign_in_required", 401);
  const body = (await req.json().catch(() => null)) as { circleId?: unknown; recipientId?: unknown; message?: unknown; note?: unknown } | null;
  const circleId = typeof body?.circleId === "string" && UUID.test(body.circleId) ? body.circleId : null;
  const recipientId = body?.recipientId == null ? null : typeof body.recipientId === "string" && UUID.test(body.recipientId) ? body.recipientId : undefined;
  if (!circleId || recipientId === undefined || typeof body?.message !== "string") return fail("bad_request");
  const note = typeof body.note === "string" ? body.note : "";

  const { data: sent, error } = await who.db.rpc("send_nudge", { p_circle: circleId, p_recipient: recipientId, p_message: body.message, p_note: note || null });
  if (error) return dbFail(error.message);

  await emailNudges(req, who.user.id).catch((e) => console.error("Nudge emails failed", e));
  return Response.json({ sent });
}

async function emailNudges(req: Request, senderId: string) {
  const admin = supabaseAdmin();
  const { base, trusted } = appUrl(req);
  if (!admin || !trusted || !process.env.RESEND_API_KEY) return;

  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: nudges } = await admin
    .from("nudges")
    .select("id, recipient_id, message, note, circles(name)")
    .eq("sender_id", senderId)
    .eq("skipped", false)
    .is("emailed_at", null)
    .gte("created_at", since);
  if (!nudges?.length) return;

  const ids = nudges.map((n) => n.recipient_id as string);
  const [{ data: wants }, { data: sender }] = await Promise.all([
    admin.from("profiles").select("id").in("id", ids).eq("nudge_email", true),
    admin.from("profiles").select("display_name").eq("id", senderId).maybeSingle(),
  ]);
  const yes = new Set((wants ?? []).map((p) => p.id as string));
  const from = (sender?.display_name as string | null) || "A Lamplighter";

  for (const n of nudges) {
    if (!yes.has(n.recipient_id as string)) continue;
    const { data: u } = await admin.auth.admin.getUserById(n.recipient_id as string);
    const to = u.user?.email;
    if (!to) continue;
    const circle = (n.circles as unknown as { name: string } | null)?.name ?? "your Circle";
    const ok = await sendEmail({
      to,
      subject: `${from} nudged you: ${n.message as string}`,
      lines: [`${from} from ${circle} sent you a nudge:`, `"${n.message as string}"`, ...(n.note ? [`"${n.note as string}"`] : []), "Turn off nudge emails any time on Me in Lampstand."],
      button: { label: "Open Lampstand", href: base },
    });
    if (ok) await admin.from("nudges").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
  }
}
