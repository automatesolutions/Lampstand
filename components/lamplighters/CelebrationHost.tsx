"use client";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { dismissCelebration, useCelebration } from "@/lib/lamplighters/celebrate";
import { Mascot } from "./Mascot";

// Confetti colors: gold leaf and the manuscript pigments.
const COLORS = ["var(--leaf-1)", "var(--leaf-3)", "var(--gold)", "var(--pg-law)", "var(--pg-gospels)", "var(--pg-history)", "var(--pg-prophets)"];
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 7) * 90}ms`,
  duration: `${1500 + ((i * 53) % 900)}ms`,
  color: COLORS[i % COLORS.length],
  turn: `${((i * 47) % 360) - 180}deg`,
  round: i % 3 === 0,
}));

/** Milestone celebrations from lib/lamplighters/celebrate (mounted once, in the root layout). */
export function CelebrationHost() {
  const c = useCelebration();
  return (
    <Sheet open={!!c} onOpenChange={(open) => !open && dismissCelebration()} title={c?.title ?? "Nice work!"} description={c?.text}>
      {c && (
        <div key={c.id} className="relative flex flex-col items-center gap-3 pb-2 pt-2 text-center">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-14 h-64 overflow-hidden motion-reduce:hidden">
            {PIECES.map((p, i) => (
              <span
                key={i}
                className={`confetti absolute top-0 block h-3 w-2 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
                style={{ left: p.left, background: p.color, animationDelay: p.delay, animationDuration: p.duration, ["--turn" as string]: p.turn }}
              />
            ))}
          </div>
          <Mascot mood={c.mood} size={148} className="arrive" />
          <p className="max-w-[34ch] text-body text-text-secondary">{c.text}</p>
          <Button variant="primary" size="large" className="mt-3" onClick={dismissCelebration}>
            Keep going
          </Button>
        </div>
      )}
    </Sheet>
  );
}
