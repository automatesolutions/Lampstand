"use client";

interface Props<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Segmented control as a radio group: arrow keys move, 44px tall. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-surface p-1">
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const nextOpt = options[(i + dir + options.length) % options.length];
              onChange(nextOpt.value);
              const sibling = (e.currentTarget.parentElement?.children[(i + dir + options.length) % options.length] as HTMLElement) ?? null;
              sibling?.focus();
            }}
            className={`min-h-11 rounded-[10px] text-subhead transition-colors duration-150 ${
              checked ? "bg-surface-raised font-semibold text-text shadow-soft" : "text-text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
