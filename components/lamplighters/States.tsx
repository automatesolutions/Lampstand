"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { mascotMessage } from "@/lib/lamplighters/assets";
import { MascotSays } from "./Mascot";

/** Placeholder rows while a list loads. */
export function LoadingRows({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[76px] animate-pulse items-center gap-3 rounded-lg bg-surface px-4 motion-reduce:animate-none">
          <span className="size-11 rounded-full bg-divider/70" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-2/5 rounded-full bg-divider/70" />
            <span className="h-3 w-3/5 rounded-full bg-divider/50" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-surface px-4 py-4">
      <p className="text-body">{message}</p>
      {onRetry && (
        <Button icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** The mascot with a message and an action, for empty screens. */
export function EmptyState({ kind, seed, children }: { kind: Parameters<typeof mascotMessage>[0]; seed?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface px-4 py-5">
      <MascotSays message={mascotMessage(kind, seed ?? kind)} size={96} />
      {children}
    </div>
  );
}

const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto", style: "short" });

/** "now", "5 min. ago", "yesterday", "Oct 12". */
export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 7 * 86400) return rtf.format(-Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
