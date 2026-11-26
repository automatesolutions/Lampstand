"use client";

import { useState, type ReactNode } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ListGroup, ListRow } from "@/components/ui/List";
import { Sheet } from "@/components/ui/Sheet";
import { dismissInstall, promptInstall, useInstall, type InstallDevice } from "@/lib/install";

const COPY: Record<InstallDevice, { title: string; subtitle: string; icon: IconName }> = {
  phone: { title: "Add Lampstand to your phone", subtitle: "Open it from your home screen, like an app.", icon: "smartphone" },
  tablet: { title: "Add Lampstand to your tablet", subtitle: "Open it from your home screen, like an app.", icon: "tablet-smartphone" },
  computer: { title: "Install Lampstand", subtitle: "Open it in its own window.", icon: "monitor-down" },
};

/**
 * Installs Lampstand where the browser allows it: Chrome's or Edge's own dialog, or the
 * Share menu steps on iPhone and iPad. Hidden once installed. The Today card can be
 * dismissed for 14 days; the Me row stays so people can still find it.
 */
export function InstallAppButton({ variant }: { variant: "card" | "row" }) {
  const { how, device, dismissed } = useInstall();
  const [stepsOpen, setStepsOpen] = useState(false);
  if (!how || (variant === "card" && dismissed)) return null;

  const copy = COPY[device];
  const install = () => (how === "prompt" ? void promptInstall() : setStepsOpen(true));
  const steps = <IosSteps open={stepsOpen} onOpenChange={setStepsOpen} />;

  if (variant === "row") {
    return (
      <ListGroup label="App">
        <ListRow title={copy.title} subtitle={copy.subtitle} icon={copy.icon} chevron onClick={install} />
        {steps}
      </ListGroup>
    );
  }

  return (
    <div className="flex min-h-16 items-center gap-1 rounded-lg bg-surface py-1 pl-4 pr-1">
      <button type="button" onClick={install} aria-haspopup={how === "ios" ? "dialog" : undefined} className="flex min-w-0 flex-1 items-center gap-3.5 py-2 text-left">
        <Icon name={copy.icon} className="size-6 text-gold" />
        <span className="min-w-0 flex-1">
          <span className="block text-headline">{copy.title}</span>
          <span className="block text-footnote text-text-secondary">{copy.subtitle}</span>
        </span>
      </button>
      <IconButton icon="x" label="Not now" onClick={dismissInstall} className="text-text-secondary" />
      {steps}
    </div>
  );
}

function IosSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add to Home Screen"
      description="How to add Lampstand to your Home Screen in Safari"
      footer={
        <Button variant="primary" size="large" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      }
    >
      <ol className="flex flex-col gap-4 py-2 text-body">
        <Step n={1}>
          <span>
            Tap the Share button <Icon name="share" className="size-5 align-[-3px] text-gold-text" />.
          </span>
          <span className="block text-footnote text-text-secondary">
            If you don&rsquo;t see Share, tap <Icon name="ellipsis" className="size-4 align-[-3px]" /> first.
          </span>
        </Step>
        <Step n={2}>
          Tap Add to Home Screen <Icon name="square-plus" className="size-5 align-[-3px] text-gold-text" />.
        </Step>
        <Step n={3}>Tap Add.</Step>
      </ol>
    </Sheet>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-gold-wash text-subhead font-semibold text-gold-text">
        {n}
      </span>
      <span className="min-w-0 flex-1 pt-0.5">{children}</span>
    </li>
  );
}
