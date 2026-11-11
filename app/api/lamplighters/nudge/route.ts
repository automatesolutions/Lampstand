import { caller, dbFail, fail } from "@/lib/lamplighters/server";
import { emailNotifications } from "@/lib/lamplighters/notify";

// Sends a nudge through public.send_nudge, which enforces every limit and mute and
// writes an in-app notification for each person it reached (one member or the whole
// Circle). Then emails the ones who turned on nudge emails (lib/lamplighters/notify).

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
  // A retry after a dropped connection gets "already_nudged"; still finish any emails
  // the first try didn't send. Claimed emails are never sent twice.
  await emailNotifications(req, who.user.id, circleId);
  if (error) return dbFail(error.message);
  return Response.json({ sent });
}
