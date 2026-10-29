"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Mascot } from "@/components/lamplighters/Mascot";
import { ProfileSheet } from "@/components/lamplighters/ProfileSheet";
import { ErrorState, LoadingRows } from "@/components/lamplighters/States";
import { Button } from "@/components/ui/Button";
import { PageTitle } from "@/components/ui/NavBar";
import { acceptInvite, friendly, invitePreview, useLampProfile, useLoad } from "@/lib/lamplighters/client";
import { sendSignInLink, signOut } from "@/lib/sync";

const noop = () => () => {};

/** The invite link's token, read on the client (the link is never prerendered). */
function useToken() {
  const href = useSyncExternalStore(noop, () => location.href, () => "");
  if (!href) return undefined;
  const t = new URL(href).searchParams.get("token");
  return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
}

/** Where an invite link lands: sign in with the invited email, then join. */
export default function JoinPage() {
  const router = useRouter();
  const token = useToken();
  const me = useLampProfile();
  const preview = useLoad(token ? () => invitePreview(token) : null, [token]);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinedId, setJoinedId] = useState<string | null>(null);

  const header = <PageTitle back={{ href: "/circles", label: "Circles" }}>You&apos;re invited</PageTitle>;
  if (token === undefined || (token && (preview.loading || !me.ready))) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <LoadingRows rows={1} label="Opening your invite" />
      </div>
    );
  }

  const p = preview.data;
  const dead = !token || !p ? "This invite link doesn't work. Check you copied all of it, or ask for a new one." : p.status === "expired" ? "This invite has expired. Ask your friend to send a new one." : p.status === "revoked" ? "This invite was cancelled. Ask your friend for a new one." : p.status === "accepted" ? "This invite has already been used." : null;

  async function signIn(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError("Enter an email address like name@example.com.");
    setBusy(true);
    setError("");
    const problem = await sendSignInLink(address, `/circles/join?token=${token}`);
    setBusy(false);
    if (problem) setError(problem);
    else setSentTo(address);
  }

  async function join() {
    setBusy(true);
    setError("");
    try {
      const id = await acceptInvite(token!);
      if (me.data?.display_name) router.push(`/circles/${id}`);
      else setJoinedId(id);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="arrive flex flex-col gap-6">
      {header}
      {preview.error && !p ? (
        <ErrorState message={preview.error} onRetry={preview.reload} />
      ) : dead && p?.status !== "accepted" ? (
        <ErrorState message={dead} />
      ) : (
        <section className="flex flex-col items-center gap-4 rounded-xl bg-surface px-5 py-7 text-center">
          <Mascot mood="waving" size={120} />
          <h2 className="text-title">{p!.circle_name}</h2>
          <p className="max-w-[36ch] text-body text-text-secondary">
            {p!.inviter_name} invited you to read the Bible together in a private Circle. Lamplighters see when you&apos;ve read today, and can nudge and cheer you on.
          </p>

          {p!.status === "accepted" && !me.userId ? (
            <p className="text-body">This invite has already been used. If it was you, sign in to see the Circle.</p>
          ) : me.userId ? (
            <>
              {error && (
                <p role="alert" className="text-callout text-danger">
                  {error}
                </p>
              )}
              <Button variant="primary" size="large" onClick={join} disabled={busy}>
                {busy ? "Joining…" : `Join ${p!.circle_name}`}
              </Button>
              {error.includes("different email") && (
                <Button variant="plain" icon="log-out" onClick={() => signOut()}>
                  Sign out and use {p!.email_hint}
                </Button>
              )}
            </>
          ) : sentTo ? (
            <p role="status" className="text-body">
              Check <strong className="font-semibold">{sentTo}</strong> for a sign-in link. Open it in this browser and you&apos;ll come right back here to join.
            </p>
          ) : (
            <form onSubmit={signIn} className="flex w-full flex-col gap-3 text-left" noValidate>
              <label className="flex flex-col gap-1.5">
                <span className="text-caption text-text-secondary">Sign in with the invited email ({p!.email_hint})</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  placeholder="name@example.com"
                  className="min-h-[52px] rounded-md bg-surface-raised px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
                />
              </label>
              {error && (
                <p role="alert" className="text-callout text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" size="large" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </Button>
              <p className="text-footnote text-text-secondary">No password. Your reading on this device comes with you.</p>
            </form>
          )}
        </section>
      )}
      <Link href="/" className="min-h-11 self-center content-center font-medium text-gold-text">
        Go to Today
      </Link>

      {joinedId && me.userId && (
        <ProfileSheet
          open
          onOpenChange={(o) => !o && router.push(`/circles/${joinedId}`)}
          userId={me.userId}
          profile={me.data}
          welcome
          onSaved={() => router.push(`/circles/${joinedId}`)}
        />
      )}
    </div>
  );
}
