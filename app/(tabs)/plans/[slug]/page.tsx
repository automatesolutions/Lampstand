import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PLANS, planBySlug } from "@/lib/plans";
import { PlanDetail } from "./PlanDetail";

export function generateStaticParams() {
  return PLANS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/plans/[slug]">): Promise<Metadata> {
  const plan = planBySlug((await params).slug);
  return plan ? { title: plan.title } : {};
}

export default async function PlanPage({ params }: PageProps<"/plans/[slug]">) {
  const plan = planBySlug((await params).slug);
  if (!plan) notFound();
  return <PlanDetail slug={plan.slug} />;
}
