"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { joinGame, quizError } from "@/lib/quiz/client";

/** Join a live Bible challenge with the code the host shares. Only games in my Circles open. */
export function JoinGameSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("The code has six letters and numbers.");
    setBusy(true);
    setError("");
    try {
      router.push(`/challenge/${await joinGame(code)}`);
    } catch (err) {
      setError(quizError(err));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Join a game" description="Join a live Bible challenge with its code">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">Game code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABC234"
            className="min-h-14 rounded-md bg-surface px-4 text-center font-display text-[1.75rem] font-semibold tracking-[0.2em] ring-1 ring-divider focus:ring-2 focus:ring-gold"
          />
        </label>
        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="large" disabled={busy}>
          Join
        </Button>
      </form>
    </Sheet>
  );
}
