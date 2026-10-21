"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Lamp } from "@/components/brand/LampMark";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";

// Where the sign-in email's link lands. The Supabase client finishes signing in
// from the link's code on load; then sync runs and the reader goes to Me.

const noop = () => () => {};

/** An error Supabase put in the link (for example an expired link). */
function useLinkError() {
  const href = useSyncExternalStore(noop, () => location.href, () => "");
  if (!href) return null;
  const u = new URL(href);
  const err = new URLSearchParams(u.search + u.hash.replace(/^#/, "&")).get("error_description");
  if (!err) return null;
  return /expired|invalid/i.test(err) ? "This link has expired or was already used. Ask for a new one on Me." : err;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const sync = useSyncStatus();
  const linkError = useLinkError();
  const [noSession, setNoSession] = useState<string | null>(null);
  const failed = linkError ?? noSession;

  useEffect(() => {
    if (linkError) return;
    // If no session arrives, the link didn't work.
    const t = setTimeout(async () => {
      const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
      if (!data.session) setNoSession("That sign-in link didn't work. Open it in the browser you asked from, or ask for a new one on Me.");
    }, 8000);
    return () => clearTimeout(t);
  }, [linkError]);

  useEffect(() => {
    if (sync.email && sync.lastSynced) router.replace("/me");
  }, [sync.email, sync.lastSynced, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-5 px-gutter text-center">
      <Lamp progress={failed ? 0.2 : 1} size={96} kindle={!failed} />
      {failed ? (
        <>
          <h1 className="text-title">Not signed in</h1>
          <p role="alert" className="text-body text-text-secondary">
            {failed}
          </p>
          <Link href="/me" className="min-h-11 content-center font-medium text-gold-text">
            Go to Me
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-title">{sync.email ? "Signed in" : "Signing you in…"}</h1>
          <p role="status" className="text-body text-text-secondary">
            {sync.email ? (sync.error ?? "Saving your reading to your account…") : "One moment."}
          </p>
        </>
      )}
    </main>
  );
}
