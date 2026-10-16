import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function ListGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {label && <h2 className="px-1 text-eyebrow text-text-secondary">{label}</h2>}
      <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">{children}</ul>
    </section>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  icon?: IconName;
  href?: string;
  onClick?: () => void;
  chevron?: boolean;
  selected?: boolean;
}

/** 56px minimum height, hairline separator inset 16px (DESIGN.md §5.2). */
export function ListRow({ title, subtitle, value, icon, href, onClick, chevron = !!href, selected }: RowProps) {
  const inner = (
    <>
      {icon && <Icon name={icon} className="size-5 text-gold" />}
      <span className="flex min-w-0 flex-1 flex-col py-3">
        <span className="text-headline">{title}</span>
        {subtitle && <span className="text-subhead text-text-secondary">{subtitle}</span>}
      </span>
      {value != null && <span className="text-body text-text-secondary">{value}</span>}
      {selected && <Icon name="check" className="size-5 text-gold-text" />}
      {chevron && <Icon name="chevron-right" className="size-5 text-text-tertiary" />}
    </>
  );
  const cls =
    "flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors active:bg-gold-wash [@media(hover:hover)]:hover:bg-gold-wash/60";
  return (
    <li className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls} aria-pressed={selected}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}
