// Which highlights auto-share should send where (pure, so it can be tested).

import type { Highlight } from "@/lib/store";

export interface AutoChoice {
  circle_id: string;
  /** When "Share my new highlights here" was turned on for this Circle. */
  created_at: string;
}

/**
 * Highlights made after auto-share was turned on for a Circle, not yet sent there from
 * this device (`done` holds "highlightId:circleId"), newest first, at most `limit`.
 */
export function pickAutoShares(highlights: Highlight[], choices: AutoChoice[], done: Set<string>, limit: number) {
  const out: { highlightId: string; circleIds: string[] }[] = [];
  const newestFirst = [...highlights].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const h of newestFirst) {
    const circleIds = choices.filter((c) => Date.parse(h.createdAt) > Date.parse(c.created_at) && !done.has(`${h.id}:${c.circle_id}`)).map((c) => c.circle_id);
    if (circleIds.length) out.push({ highlightId: h.id, circleIds });
    if (out.length >= limit) break;
  }
  return out;
}
