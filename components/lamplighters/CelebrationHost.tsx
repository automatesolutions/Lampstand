"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { mascotMessage, seedOf, type MascotMessage } from "@/lib/lamplighters/assets";
import { dismissCelebration, useCelebration, type Celebration } from "@/lib/lamplighters/celebrate";
import { Mascot } from "./Mascot";

// Confetti colors: gold leaf and the manuscript pigments.
const COLORS = ["var(--leaf-1)", "var(--leaf-3)", "var(--gold)", "var(--pg-law)", "var(--pg-gospels)", "var(--pg-history)", "var(--pg-prophets)"];

/** Confetti thrown out from the mascot in a ring, then falling a little. */
function burst(count: number, reach: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
    const r = reach * (0.55 + ((i * 37) % 45) / 100);
    return {
      dx: `${Math.round(Math.cos(a) * r)}px`,
      dy: `${Math.round(Math.sin(a) * r * 0.8 + 60)}px`,
      turn: `${((i * 47) % 540) - 270}deg`,
      color: COLORS[i % COLORS.length],
      delay: `${(i % 5) * 40}ms`,
      round: i % 3 === 0,
    };
  });
}
const BIG = burst(36, 190);
const SMALL = burst(14, 120);

/**
 * The mascot popping out (mounted once, in the root layout): a quick cheer that springs
 * up from the bottom and hides itself, or a milestone celebration with a confetti burst.
 * Tap the mascot for a bounce, a playful reply and (at milestones) more confetti.
 */
export function CelebrationHost() {
  const c = useCelebration();
  if (!c) return null;
  return c.milestone ? <MilestonePop key={c.id} c={c} /> : <CheerPop key={c.id} c={c} />;
}

function useReply(c: MascotMessage) {
  const [reply, setReply] = useState<MascotMessage | null>(null);
  const next = () => setReply((r) => mascotMessage("tap", seedOf(r?.text ?? c.text) + 1));
  return [reply ?? c, next] as const;
}

/** A quick cheer: springs up above the tab bar, stays 5 seconds (longer while hovered). */
function CheerPop({ c }: { c: Celebration }) {
  const [shown, tap] = useReply(c);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  // In the reader the thumb bar sits above the tab bar, so the cheer pops up higher.
  const onReader = usePathname().startsWith("/read/");

  useEffect(() => {
    if (held || leaving) return;
    const t = setTimeout(() => setLeaving(true), 5000);
    return () => clearTimeout(t);
  }, [held, leaving, shown]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(dismissCelebration, 280);
    return () => clearTimeout(t);
  }, [leaving]);

  return (
    <div className={`pointer-events-none fixed inset-x-0 ${onReader ? "bottom-[calc(env(safe-area-inset-bottom)+144px)]" : "bottom-[calc(env(safe-area-inset-bottom)+84px)]"} z-40 flex justify-center px-4 min-[960px]:bottom-8 min-[960px]:justify-end min-[960px]:px-8`}>
      <div
        role="status"
        data-leaving={leaving || undefined}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        className="mascot-pop pointer-events-auto flex w-full max-w-[380px] items-end gap-2"
      >
        <span className="relative">
          {SMALL.map((p, i) => (
            <Piece key={i} p={p} />
          ))}
          <Mascot mood={c.mood} size={84} seed={seedOf(c.text)} onTap={() => (tap(), setHeld(true))} />
        </span>
        <div key={shown.text} className="mascot-bubble relative mb-3 flex min-w-0 flex-1 items-start gap-1 rounded-lg rounded-bl-[6px] bg-surface-raised py-3 pl-4 pr-1 shadow-float ring-1 ring-divider/60">
          <p className="min-w-0 flex-1 py-0.5 text-subhead">
            {shown.title && <strong className="block text-headline">{shown.title}</strong>}
            {shown.text}
          </p>
          <button type="button" onClick={() => setLeaving(true)} aria-label="Close" className="-my-2 grid size-11 shrink-0 place-items-center rounded-full text-text-secondary">
            <Icon name="x" className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** A milestone: the mascot bursts out of a glow with confetti. Tap it for another round. */
function MilestonePop({ c }: { c: Celebration }) {
  const [shown, tap] = useReply(c);
  const [bursts, setBursts] = useState(1);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissCelebration();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div aria-hidden="true" onClick={dismissCelebration} className="fade-in absolute inset-0 bg-black/45" />
      <div role="dialog" aria-modal="true" aria-labelledby="milestone-title" aria-describedby="milestone-text" className="milestone-card relative w-full max-w-[360px] rounded-2xl bg-surface-raised px-6 pb-6 pt-[104px] text-center shadow-float">
        <div className="absolute left-1/2 top-0 size-0">
          <span aria-hidden="true" className="mascot-rays absolute -left-[150px] -top-[150px] size-[300px] rounded-full" />
          <span key={bursts} aria-hidden="true">
            {BIG.map((p, i) => (
              <Piece key={i} p={p} />
            ))}
          </span>
          <span className="mascot-burst-in absolute -left-[76px] -top-[96px] block">
            <Mascot mood={c.mood} size={152} seed={seedOf(c.text)} onTap={() => (tap(), setBursts((n) => n + 1))} />
          </span>
        </div>
        {/* A tap swaps the headline for the mascot's playful reply; the milestone stays below. */}
        <h2 id="milestone-title" key={shown.text} className="mascot-bubble text-title-2">
          {shown === c ? (c.title ?? c.text) : shown.text}
        </h2>
        <p id="milestone-text" className="mt-2 text-body text-text-secondary">
          {c.text}
        </p>
        <p className="mt-3 text-footnote text-text-tertiary">Tap the lamp to celebrate again</p>
        <Button ref={button} variant="primary" size="large" className="mt-5 w-full" onClick={dismissCelebration}>
          Keep going
        </Button>
      </div>
    </div>
  );
}

function Piece({ p }: { p: ReturnType<typeof burst>[number] }) {
  return (
    <span
      aria-hidden="true"
      className={`confetti-burst pointer-events-none absolute left-1/2 top-1/2 block h-3 w-2 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
      style={{ background: p.color, animationDelay: p.delay, ["--dx" as string]: p.dx, ["--dy" as string]: p.dy, ["--turn" as string]: p.turn }}
    />
  );
}
