import type { Metadata } from "next";
import { Fleuron, Lamp } from "@/components/brand/LampMark";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <>
      <div className="arrive flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Lamp progress={1} size={132} kindle />
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-display text-[3.25rem] font-semibold leading-none">Lampstand</h1>
          <Fleuron className="w-40" />
          <p className="mx-auto max-w-[30ch] text-body text-text-secondary">
            Read the Bible each day, and understand what you read.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <ButtonLink href="/start" variant="primary" size="large">
          Begin reading
        </ButtonLink>
        <p className="text-center text-footnote text-text-secondary">No account needed. Your reading stays on this device.</p>
      </div>
    </>
  );
}
