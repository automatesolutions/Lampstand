"use client";

import { useState } from "react";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { ButtonLink } from "@/components/ui/Button";
import { accountsEnabled } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";

/**
 * Sign in with Google first (it saves reading on every device and opens Circles), or
 * read without an account. After Google, the app comes back to Today: a returning
 * reader goes straight in, a new one lands here again, signed in, to pick a start.
 */
export function WelcomeActions() {
  const sync = useSyncStatus();
  const [error, setError] = useState("");

  if (!accountsEnabled || sync.email) {
    return (
      <div className="flex flex-col gap-3">
        <ButtonLink href="/start" variant="primary" size="large">
          Begin reading
        </ButtonLink>
        <p className="text-center text-footnote text-text-secondary">
          {sync.email ? `Signed in as ${sync.email}.` : "No account needed. Your reading stays on this device."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <GoogleSignIn next="/" onError={setError} divider={false} />
      {error && (
        <p role="alert" className="text-center text-callout text-danger">
          {error}
        </p>
      )}
      <ButtonLink href="/start" variant="plain" size="large">
        Read without an account
      </ButtonLink>
      <p className="text-center text-footnote text-text-secondary">Signing in saves your reading on every device and lets you join Circles.</p>
    </div>
  );
}
