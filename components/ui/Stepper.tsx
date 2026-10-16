"use client";

import { IconButton } from "./Button";

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string; // e.g. "Chapters per day"
  unit: (n: number) => string; // e.g. n => n === 1 ? "chapter" : "chapters"
}

export function Stepper({ value, onChange, min = 1, max = 10, label, unit }: Props) {
  return (
    <div role="group" aria-label={label} className="flex items-center justify-center gap-6">
      <IconButton icon="minus" label={`Fewer ${unit(2)}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="bg-surface disabled:opacity-40" />
      <output aria-live="polite" className="flex min-w-24 flex-col items-center">
        <span className="text-large-title tabular-nums">{value}</span>
        <span className="text-subhead text-text-secondary">{unit(value)}</span>
      </output>
      <IconButton icon="plus" label={`More ${unit(2)}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="bg-surface disabled:opacity-40" />
    </div>
  );
}
