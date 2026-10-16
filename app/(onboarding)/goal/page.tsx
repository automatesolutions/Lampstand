"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { planBySlug } from "@/lib/plans";
import { completeOnboarding, setGoal } from "@/lib/store";

const chapters = (n: number) => (n === 1 ? "chapter a day" : "chapters a day");

function GoalForm() {
  const router = useRouter();
  const plan = planBySlug(useSearchParams().get("plan") ?? "");
  const suggested = plan ? Math.max(...plan.days.map((d) => d.length)) : 1;
  const [n, setN] = useState(suggested);

  return (
    <>
      <div className="flex flex-col gap-2 pt-10">
        <h1 className="text-title-1">Set a daily goal</h1>
        <p className="text-body text-text-secondary">
          {plan ? `${plan.title} needs about ${suggested} ${chapters(suggested)}.` : "Start small. You can change it any time."}
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <Stepper value={n} onChange={setN} label="Chapters per day" unit={chapters} />
      </div>
      <Button
        variant="primary"
        size="large"
        onClick={() => {
          setGoal(n);
          completeOnboarding();
          router.replace("/");
        }}
      >
        Start reading
      </Button>
    </>
  );
}

export default function GoalPage() {
  return (
    <Suspense>
      <GoalForm />
    </Suspense>
  );
}
