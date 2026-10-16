"use client";

// Lets any screen open the Go to palette and offer its own actions there
// (the reader adds "Mark John 3 as read", for example).

import { useSyncExternalStore } from "react";
import type { IconName } from "@/components/ui/Icon";

export interface PaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  run: () => void;
}

const OPEN_EVENT = "lampstand:goto";

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenPalette(fn: () => void) {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
}

let screenActions: PaletteAction[] = [];
const listeners = new Set<() => void>();

/** Replace the current screen's actions; returns a cleanup that removes them. */
export function setScreenActions(actions: PaletteAction[]) {
  screenActions = actions;
  listeners.forEach((l) => l());
  return () => {
    if (screenActions === actions) {
      screenActions = [];
      listeners.forEach((l) => l());
    }
  };
}

const EMPTY: PaletteAction[] = [];

export function useScreenActions(): PaletteAction[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => screenActions,
    () => EMPTY,
  );
}
