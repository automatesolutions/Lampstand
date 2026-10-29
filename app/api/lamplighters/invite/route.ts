import { appUrl, caller, dbFail, fail, sendEmail } from "@/lib/lamplighters/server";

// Creates an invite ({ circleId, email }) or a fresh link for a pending one ({ inviteId }),
// then emails it when email is set up. The link is always returned so the inviter can
// copy it; the token is never stored, only its hash (supabase/migrations/0005).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return fail("sign_in_required", 401);
  const body = (await req.json().catch(() => null)) as { circleId?: unknown; email?: unknown; inviteId?: unknown } | null;

  let row: { token: string; email?: string; circle_name: string; inviter_name: string } | undefined;
  let email = "";
  if (typeof body?.inviteId === "string" && UUID.test(body.inviteId)) {
    const { data, error } = await who.db.rpc("resend_invite", { p_invite: body.inviteId });
    if (error) return dbFail(error.message);
    row = data?.[0];
    email = row?.email ?? "";
  } else if (typeof body?.circleId === "string" && UUID.test(body.circleId) && typeof body.email === "string") {
    email = body.email.trim().toLowerCase().slice(0, 254);
    const { data, error } = await who.db.rpc("create_invite", { p_circle: body.circleId, p_email: email });
    if (error) return dbFail(error.message);
    row = data?.[0];
  } else {
    return fail("bad_request");
  }
  if (!row) return fail("unknown", 500);

  const { base, trusted } = appUrl(req);
  const link = `${base}/circles/join?token=${row.token}`;
  const emailed =
    trusted &&
    (await sendEmail({
      to: email,
      subject: `${row.inviter_name} invited you to ${row.circle_name} on Lampstand`,
      lines: [
        `${row.inviter_name} would like you to join "${row.circle_name}", a private Circle on Lampstand where friends read the Bible and cheer each other on.`,
        `Sign in with this email address (${email}) to join. The link works for 7 days.`,
      ],
      button: { label: "Join the Circle", href: link },
    }));

  return Response.json({ link, emailed, email });
}
