"use client";

// Selecting one verse or a run of verses in the reader (DESIGN.md §8 Verse).
//
// - Tap or click a verse: select it (again: clear).
// - Mouse: press and drag across verses. Range mode starts only when the pointer reaches a
//   second verse, so selecting words inside one verse to copy still works as usual.
// - Phone: long-press a verse (450ms, holding still), then drag. Moving before then is a
//   scroll, never a selection, and the page scrolls normally; only during the drag does
//   the page stop scrolling (it scrolls itself near the top and bottom edges).
// - Fallbacks: Shift-click a last verse, or "Select more" and then tap a last verse.
// - Keyboard: Shift with Arrow Up or Down grows or shrinks the selection (in Reader).

import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import type { Span } from "@/lib/highlights/ranges";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10; // px a finger may wander before it counts as a scroll
const EDGE = 110; // px from the top or bottom where a drag scrolls the page

function verseAt(x: number, y: number, within: HTMLElement | null): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-verse]");
  if (!el || !within?.contains(el)) return null;
  const n = Number(el.dataset.verse);
  return Number.isInteger(n) ? n : null;
}

/** While dragging near an edge, move the page so the drag can reach verses off screen. */
function edgeScroll(y: number) {
  if (y < EDGE) window.scrollBy(0, -Math.ceil((EDGE - y) / 6));
  else if (y > innerHeight - EDGE - 120) window.scrollBy(0, Math.ceil((y - (innerHeight - EDGE - 120)) / 6)); // above the thumb and tab bars
}

export function useRangeSelect(textRef: RefObject<HTMLElement | null>) {
  const [sel, setSel] = useState<Span | null>(null);
  const [extending, setExtending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const anchor = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const rangedByTouch = useRef(false); // this touch became a selection: not a swipe

  /** Selects one verse (null clears), and makes it the anchor for extending. */
  const selectOne = useCallback((n: number | null) => {
    anchor.current = n;
    setSel(n == null ? null : { start: n, end: n });
    setExtending(false);
  }, []);

  /** From the anchor to `n`. */
  const extendTo = useCallback((n: number) => {
    const a = anchor.current ?? n;
    anchor.current = a;
    setSel({ start: Math.min(a, n), end: Math.max(a, n) });
  }, []);

  /** The verse at the moving end of the selection (the one away from the anchor). */
  const movingEnd = () => (sel && anchor.current === sel.start ? sel.end : sel?.start ?? null);

  function onVerseClick(e: MouseEvent, n: number) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (sel && (e.shiftKey || extending)) {
      extendTo(n);
      setExtending(false);
      return;
    }
    selectOne(sel && sel.start === n && sel.end === n ? null : n);
  }

  // Mouse: press and drag.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    let start: number | null = null;
    let active = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      start = verseAt(e.clientX, e.clientY, el);
      active = false;
    };
    const move = (e: PointerEvent) => {
      if (start == null || !(e.buttons & 1)) return;
      const v = verseAt(e.clientX, e.clientY, el);
      if (v == null) return edgeScroll(e.clientY);
      if (!active && v === start) return; // words inside one verse: the browser's own selection
      if (!active) {
        active = true;
        anchor.current = start;
        setDragging(true);
        setExtending(false);
      }
      window.getSelection()?.removeAllRanges();
      extendTo(v);
      edgeScroll(e.clientY);
    };
    const up = () => {
      if (active) {
        suppressClick.current = true; // the click that ends a drag isn't a tap
        window.setTimeout(() => (suppressClick.current = false), 0);
        setDragging(false);
      }
      start = null;
      active = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [textRef, extendTo]);

  // Touch: long-press, then drag.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    let press: { x: number; y: number; verse: number; timer: number; active: boolean } | null = null;
    const cancel = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
    };
    const start = (e: TouchEvent) => {
      rangedByTouch.current = false;
      cancel();
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const verse = verseAt(t.clientX, t.clientY, el);
      if (verse == null) return;
      const p = {
        x: t.clientX,
        y: t.clientY,
        verse,
        active: false,
        timer: window.setTimeout(() => {
          p.active = true;
          rangedByTouch.current = true;
          anchor.current = verse;
          setSel({ start: verse, end: verse });
          setExtending(false);
          setDragging(true);
          navigator.vibrate?.(8);
        }, LONG_PRESS_MS),
      };
      press = p;
    };
    const move = (e: TouchEvent) => {
      if (!press) return;
      const t = e.touches[0];
      if (!press.active) {
        // Moved before the long-press: it's a scroll or a swipe. Let the browser have it.
        if (Math.hypot(t.clientX - press.x, t.clientY - press.y) > MOVE_TOLERANCE) cancel();
        return;
      }
      e.preventDefault(); // during a range drag, the page doesn't scroll under the finger
      const v = verseAt(t.clientX, t.clientY, el);
      if (v != null) extendTo(v);
      edgeScroll(t.clientY);
    };
    const end = () => {
      if (press?.active) {
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 400);
        setDragging(false);
      }
      cancel();
    };
    const menu = (e: Event) => {
      if (press?.active || rangedByTouch.current) e.preventDefault(); // no "Copy / Select all" menu over the selection
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("contextmenu", menu);
    return () => {
      cancel();
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("contextmenu", menu);
    };
  }, [textRef, extendTo]);

  return {
    /** The selected verses, or null. */
    sel,
    selectOne,
    extendTo,
    movingEnd,
    /** "Select more": the next tap ends the range. */
    extending,
    setExtending,
    /** A drag is in progress (the reader turns off text selection meanwhile). */
    dragging,
    onVerseClick,
    /** True when this touch became a range selection, so it must not also change chapter. */
    touchWasSelection: () => rangedByTouch.current,
  };
}
