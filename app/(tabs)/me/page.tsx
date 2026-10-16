"use client";

import { useState } from "react";
import { PageTitle } from "@/components/ui/NavBar";
import { ListGroup, ListRow } from "@/components/ui/List";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { ReaderSettings } from "@/components/reader/ReaderSettings";
import { VERSIONS } from "@/lib/bible/provider";
import { currentGoal, setGoal, useHydrated, useStore } from "@/lib/store";

const NLT_NOTICE = VERSIONS.find((v) => v.id === "NLT")?.copyright;
const ESV = VERSIONS.find((v) => v.id === "ESV");

const chapters = (n: number) => (n === 1 ? "chapter a day" : "chapters a day");

export default function MePage() {
  const hydrated = useHydrated();
  const goals = useStore((s) => s.goals);
  const goal = hydrated ? currentGoal(goals) : 1;
  const [goalOpen, setGoalOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="arrive flex flex-col gap-8">
      <PageTitle eyebrow="Reading on this device">Me</PageTitle>

      <ListGroup label="Account">
        <ListRow title="Save your progress" subtitle="Your reading is on this device only" icon="user" chevron onClick={() => setSaveOpen(true)} />
      </ListGroup>

      <ListGroup label="Reading">
        <ListRow title="Daily goal" value={hydrated ? `${goal} ${goal === 1 ? "chapter" : "chapters"}` : ""} chevron onClick={() => setGoalOpen(true)} />
        <ListRow title="Plans" href="/plans" />
        <ListRow title="Streak" href="/streak" />
      </ListGroup>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-eyebrow text-text-secondary">Text and appearance</h2>
        <div className="rounded-lg bg-surface-raised p-4 shadow-soft ring-1 ring-divider/60">
          <ReaderSettings />
        </div>
      </section>

      <section className="flex flex-col gap-2 px-1 text-footnote text-text-secondary">
        <h2 className="text-eyebrow">About</h2>
        <p>King James Version: public domain.</p>
        <p>{NLT_NOTICE}</p>
        <p>
          {ESV?.copyright}{" "}
          <a href={ESV?.link?.href} target="_blank" rel="noopener noreferrer" className="font-medium text-gold-text underline underline-offset-2">
            {ESV?.link?.label}
          </a>
        </p>
        <p>Book background notes are short summaries. Some are still being reviewed.</p>
      </section>

      <Sheet
        open={goalOpen}
        onOpenChange={setGoalOpen}
        title="Daily goal"
        description="Chapters to read each day"
      >
        <div className="flex flex-col items-center gap-4 py-6">
          <Stepper value={goal} onChange={setGoal} label="Chapters per day" unit={chapters} />
          <p className="text-center text-footnote text-text-secondary">A new goal starts today. Past days keep the goal they had.</p>
        </div>
      </Sheet>

      <Sheet open={saveOpen} onOpenChange={setSaveOpen} title="Save your progress">
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-body">Right now, your reading, notes and goal are saved in this browser.</p>
          <p className="text-body text-text-secondary">
            Accounts are coming soon. With an account, your reading moves with you to any device, and nothing is lost if you clear your browser.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
