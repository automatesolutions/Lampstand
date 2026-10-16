"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "plain";
type Size = "large" | "default";

const base =
  "inline-flex items-center justify-center gap-2 select-none text-headline transition-opacity disabled:opacity-40 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-gold-strong text-on-gold rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_6px_18px_-8px_var(--glow)]",
  secondary: "bg-surface text-text rounded-md",
  plain: "text-gold-text rounded-md",
};

const sizes: Record<Size, string> = {
  large: "min-h-[54px] px-6 w-full",
  default: "min-h-12 px-5",
};

const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

function usePress() {
  const reduce = useReducedMotion();
  return reduce ? { whileTap: { opacity: 0.88 } } : { whileTap: { scale: 0.97, opacity: 0.88 }, transition: spring };
}

interface ButtonProps extends Omit<ComponentProps<typeof motion.button>, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "default", icon, className = "", children, ...rest }: ButtonProps) {
  const press = usePress();
  return (
    <motion.button type="button" {...press} {...rest} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </motion.button>
  );
}

const MotionLink = motion.create(Link);

interface ButtonLinkProps extends Omit<ComponentProps<typeof MotionLink>, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  children: ReactNode;
}

export function ButtonLink({ variant = "secondary", size = "default", icon, className = "", children, ...rest }: ButtonLinkProps) {
  const press = usePress();
  return (
    <MotionLink {...press} {...rest} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </MotionLink>
  );
}

interface IconButtonProps extends Omit<ComponentProps<typeof motion.button>, "children"> {
  icon: IconName;
  label: string;
}

/** 44x44 hit area around a 22px icon. */
export function IconButton({ icon, label, className = "", ...rest }: IconButtonProps) {
  const press = usePress();
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      {...press}
      {...rest}
      className={`inline-flex size-11 items-center justify-center rounded-full text-gold-text ${className}`}
    >
      <Icon name={icon} className="size-[22px]" />
    </motion.button>
  );
}
