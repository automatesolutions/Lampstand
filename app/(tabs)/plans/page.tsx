import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/NavBar";
import { ListGroup, ListRow } from "@/components/ui/List";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <div className="arrive flex flex-col gap-6">
      <PageTitle back={{ href: "/", label: "Today" }}>Plans</PageTitle>
      <div className="flex flex-col gap-6">
        <p className="text-subhead text-text-secondary">A plan sets your reading for each day. It moves at your pace.</p>
        <ListGroup>
          {PLANS.map((p) => (
            <ListRow key={p.slug} title={p.title} subtitle={`${p.summary} ${p.days.length} days.`} href={`/plans/${p.slug}`} />
          ))}
        </ListGroup>
      </div>
    </div>
  );
}
