"use client";

import { Sheet } from "@/components/ui/Sheet";
import { ListGroup, ListRow } from "@/components/ui/List";
import { VERSIONS } from "@/lib/bible/provider";
import type { VersionId } from "@/lib/bible/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: VersionId;
  onSelect: (id: VersionId) => void;
}

/** Version picker (screen 9). Unlicensed versions are listed but not selectable. */
export function VersionSheet({ open, onOpenChange, current, onSelect }: Props) {
  const available = VERSIONS.filter((v) => v.available);
  const later = VERSIONS.filter((v) => !v.available);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Version">
      <div className="flex flex-col gap-6">
        <ListGroup>
          {available.map((v) => (
            <ListRow
              key={v.id}
              title={v.id}
              subtitle={v.name}
              selected={v.id === current}
              onClick={() => {
                onSelect(v.id);
                onOpenChange(false);
              }}
            />
          ))}
        </ListGroup>
        <section className="flex flex-col gap-2">
          <h3 className="px-4 text-caption text-text-secondary">Coming later</h3>
          <ul className="overflow-hidden rounded-lg bg-surface">
            {later.map((v) => (
              <li key={v.id} className="relative flex min-h-[52px] flex-col justify-center px-4 py-3 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                <span className="text-body text-text-secondary">{v.id}</span>
                <span className="text-subhead text-text-secondary">{v.name}</span>
              </li>
            ))}
          </ul>
          <p className="px-4 text-footnote text-text-secondary">These versions need a publisher license. They will appear here once it is in place.</p>
        </section>
      </div>
    </Sheet>
  );
}
