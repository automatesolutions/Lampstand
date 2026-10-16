"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookPicker } from "@/components/BookPicker";
import { ListGroup, ListRow } from "@/components/ui/List";
import { PLANS } from "@/lib/plans";
import { setPosition, startPlan } from "@/lib/store";

export default function StartPage() {
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex flex-col gap-8 pt-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1">Where would you like to begin?</h1>
        <p className="text-body text-text-secondary">Follow a plan, or open any book.</p>
      </div>

      <ListGroup label="Plans">
        {PLANS.map((p) => (
          <ListRow
            key={p.slug}
            title={p.title}
            subtitle={p.summary}
            chevron
            onClick={() => {
              startPlan(p.slug);
              router.push(`/goal?plan=${p.slug}`);
            }}
          />
        ))}
      </ListGroup>

      <ListGroup label="On your own">
        <ListRow title="Choose a book and chapter" icon="library" chevron onClick={() => setPicking(true)} />
      </ListGroup>

      <BookPicker
        open={picking}
        onOpenChange={setPicking}
        onSelect={(ref) => {
          startPlan(null);
          setPosition({ ...ref, verse: 1, version: "KJV" });
          router.push("/goal");
        }}
      />
    </div>
  );
}
