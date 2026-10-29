"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { friendly, resendInvite, revokeInvite, sendInvite, type Invite, type InviteResult } from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleId: string;
  circleName: string;
  invites: Invite[];
  spotsLeft: number;
  onChange: () => void;
}

const expires = (iso: string) => {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 0 ? "expired" : days === 1 ? "expires tomorrow" : `expires in ${days} days`;
};

/** Invite by email; resend or cancel invites you sent. The link can always be copied. */
export function InviteSheet({ open, onOpenChange, circleId, circleName, invites, spotsLeft, onChange }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<InviteResult>) {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      setResult(await fn());
      setEmail("");
      onChange();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError("Enter an email address like name@example.com.");
    run(() => sendInvite(circleId, address));
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Copy isn't available in this browser. Select the link and copy it.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (onOpenChange(o), o || setResult(null))} title="Invite a Lamplighter" description={`Invite a friend to ${circleName}`}>
      <div className="flex flex-col gap-5 pb-2">
        {result ? (
          <div role="status" className="flex flex-col gap-3 rounded-lg bg-gold-wash/50 px-4 py-4">
            <p className="text-body">
              {result.emailed ? (
                <>
                  Invite sent to <strong className="font-semibold">{result.email}</strong>. You can also send them the link yourself:
                </>
              ) : (
                <>
                  Send this link to <strong className="font-semibold">{result.email}</strong>. They sign in with that email to join:
                </>
              )}
            </p>
            <input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className="min-h-11 rounded-md bg-surface-raised px-3 text-footnote ring-1 ring-divider" />
            <div className="flex gap-2.5">
              <Button variant="primary" icon="copy" onClick={() => copy(result.link)}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button onClick={() => setResult(null)}>Invite someone else</Button>
            </div>
            <p className="text-footnote text-text-secondary">The link works for {LAMPLIGHTERS.inviteDays} days, for that email only.</p>
          </div>
        ) : spotsLeft <= 0 ? (
          <p className="rounded-lg bg-surface px-4 py-3.5 text-body">This Circle is full. Someone has to leave, or an invite has to be cancelled, before you can invite more.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">Their email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                placeholder="friend@example.com"
                className="min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
              />
            </label>
            <Button type="submit" variant="primary" size="large" icon="user-plus" disabled={busy}>
              {busy ? "Inviting…" : "Send invite"}
            </Button>
            <p className="text-footnote text-text-secondary">
              {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left. Only you see the emails you invite.
            </p>
          </form>
        )}

        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}

        {invites.length > 0 && (
          <section aria-labelledby="pending-heading" className="flex flex-col gap-2">
            <h3 id="pending-heading" className="text-eyebrow text-text-secondary">
              Waiting to join
            </h3>
            <ul className="overflow-hidden rounded-lg bg-surface">
              {invites.map((i) => (
                <li key={i.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body">{i.email}</span>
                    <span className="block text-footnote text-text-secondary">{expires(i.expires_at)}</span>
                  </span>
                  <button type="button" disabled={busy} onClick={() => run(() => resendInvite(i.id))} className="min-h-11 px-2 text-subhead font-medium text-gold-text">
                    Resend
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => revokeInvite(i.id).then(onChange, (e) => setError(friendly(e)))}
                    className="min-h-11 px-2 text-subhead font-medium text-danger"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-footnote text-text-secondary">Resending makes a new link; the old one stops working.</p>
          </section>
        )}
      </div>
    </Sheet>
  );
}
