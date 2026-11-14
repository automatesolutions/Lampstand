"use client";

import Link from "next/link";
import { readerHref } from "@/lib/bible/refs";
import { SWATCH } from "@/lib/highlights/colors";
import { circleShares, useLoad, type Person } from "@/lib/lamplighters/client";
import { useStore } from "@/lib/store";
import { Avatar } from "./Avatar";
import { ErrorState, LoadingRows, timeAgo } from "./States";

/** The newest highlights shared in a Circle. Each opens the reader at those verses. */
export function SharedHighlights({ circleId, people, version: v }: { circleId: string; people: Map<string, Person>; version: number }) {
  const shares = useLoad(() => circleShares(circleId, 10), [circleId, v]);
  const readingVersion = useStore((s) => s.prefs.version);
  if (shares.data && shares.data.length === 0) return null; // nothing shared yet: no empty section

  return (
    <section aria-labelledby="shared-heading" className="flex flex-col gap-2">
      <h2 id="shared-heading" className="px-1 text-eyebrow text-text-secondary">
        Shared highlights
      </h2>
      {shares.error && !shares.data ? (
        <ErrorState message={shares.error} onRetry={shares.reload} />
      ) : !shares.data ? (
        <LoadingRows rows={1} />
      ) : (
        <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
          {shares.data.map((m) => {
            const h = m.highlight!;
            const who = people.get(m.sender_id);
            return (
              <li key={m.id} className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                <Link href={readerHref(readingVersion, h, h.verse_start, h.verse_end)} className="flex min-h-16 gap-3 px-4 py-3 active:bg-gold-wash">
                  <Avatar id={who?.avatar_id} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-subhead text-text-secondary">
                      <span aria-hidden="true" className="size-3 shrink-0 rounded-full ring-1 ring-divider" style={{ background: SWATCH[h.color]?.fill }} />
                      <strong className="font-semibold text-gold-text">{h.ref}</strong>
                      <span className="truncate">
                        · {who ? (who.is_me ? "You" : who.display_name) : "A former member"} · <time dateTime={m.created_at}>{timeAgo(m.created_at)}</time>
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block font-scripture text-subhead">{h.text}</span>
                    {m.body && <span className="mt-1 line-clamp-2 block text-callout">{m.body}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
