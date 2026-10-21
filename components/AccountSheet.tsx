"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { accountsEnabled } from "@/lib/supabase/client";
import { sendSignInLink, signOut, syncNow, useSyncStatus } from "@/lib/sync";

function ago(iso: string | null) {
  if (!iso) return "not yet";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The Account row's subtitle on Me. */
export function useAccountSummary() {
  const sync = useSyncStatus();
  if (!accountsEnabled || !sync.ready) return { title: "Save your progress", subtitle: "Your reading is on this device only" };
  if (!sync.email) return { title: "Save your progress", subtitle: "Sign in with your email to keep it on every device" };
  return { title: sync.email, subtitle: sync.syncing ? "Syncing…" : sync.error ? sync.error : `Saved to your account · ${ago(sync.lastSynced)}` };
}

/** Sign in with an emailed link, or, when signed in, sync and sign out. */
export function AccountSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sync = useSyncStatus();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setSending(true);
    setError("");
    const problem = await sendSignInLink(address);
    setSending(false);
    if (problem) setError(problem);
    else setSentTo(address);
  }

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setSentTo(null);
      setError("");
    }
  }

  if (!accountsEnabled) {
    return (
      <Sheet open={open} onOpenChange={close} title="Save your progress">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-body">Right now, your reading, notes and goal are saved in this browser.</p>
          <p className="text-body text-text-secondary">Accounts aren&apos;t set up on this server yet.</p>
        </div>
      </Sheet>
    );
  }

  if (sync.email) {
    return (
      <Sheet
        open={open}
        onOpenChange={close}
        title="Your account"
        description="Your reading is saved to your account"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={() => signOut().then(() => close(false))}>Sign out</Button>
            <Button variant="primary" icon="refresh" onClick={() => syncNow(true)} disabled={sync.syncing}>
              {sync.syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-body">
            Signed in as <strong className="font-semibold">{sync.email}</strong>.
          </p>
          <p className="text-callout text-text-secondary">
            Your reading, streak, notes, highlights, goal and settings are saved to your account and come with you to any device where you sign in. Last saved {ago(sync.lastSynced)}.
          </p>
          {sync.error && (
            <p role="alert" className="rounded-md bg-surface px-4 py-3 text-callout">
              {sync.error}
            </p>
          )}
          <p className="text-footnote text-text-secondary">Signing out keeps a copy on this device.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={close} title="Save your progress" description="Sign in with a link sent to your email">
      {sentTo ? (
        <div role="status" className="flex flex-col gap-3 pb-2">
          <p className="text-body">
            We sent a sign-in link to <strong className="font-semibold">{sentTo}</strong>.
          </p>
          <p className="text-callout text-text-secondary">Open it on this device, in this browser. It can take a minute to arrive; check your spam folder too.</p>
          <button type="button" onClick={() => setSentTo(null)} className="min-h-11 self-start font-medium text-gold-text">
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
          <p className="text-body">Keep your reading, streak, notes and highlights safe, and on every device. No password: we email you a link.</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-caption text-text-secondary">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "email-error" : undefined}
              placeholder="name@example.com"
              className="min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
            />
          </label>
          {error && (
            <p id="email-error" role="alert" className="text-callout text-[var(--danger,inherit)]">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="large" disabled={sending}>
            {sending ? "Sending…" : "Email me a sign-in link"}
          </Button>
          <p className="text-footnote text-text-secondary">What&apos;s on this device now is added to your account when you sign in. Nothing is lost.</p>
        </form>
      )}
    </Sheet>
  );
}
