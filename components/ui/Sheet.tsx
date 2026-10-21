"use client";

import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { IconButton } from "./Button";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hidden description for screen readers when there is no visible one. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Bottom sheet on phones, centered panel from 640px (DESIGN.md §5).
 * Swipe down or the Close button dismisses it; Escape works too.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-xl bg-surface-raised shadow-soft outline-none sm:bottom-auto sm:top-1/2 sm:max-h-[80dvh] sm:-translate-y-1/2 sm:rounded-xl sm:after:hidden!"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-9 shrink-0 rounded-full bg-divider sm:hidden" />
          <header className="flex shrink-0 items-center justify-between gap-2 pl-5 pr-2 pt-2 sm:pt-3">
            <Drawer.Title className="text-title-2">{title}</Drawer.Title>
            <Drawer.Close asChild>
              <IconButton icon="x" label="Close" className="text-text-secondary" />
            </Drawer.Close>
          </header>
          <Drawer.Description className="sr-only">{description ?? title}</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-divider px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>
          )}
          {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
