"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/** Applies reader preferences to <html>. The inline script in the root layout does the same before first paint. */
export function ThemeSync() {
  const prefs = useStore((s) => s.prefs);
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
    root.dataset.scriptureFont = prefs.scriptureFont;
    root.style.setProperty("--scripture-size", `${prefs.textSize}px`);
    root.style.setProperty("--scripture-leading", String(prefs.leading));
  }, [prefs]);
  return null;
}

export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem("lampstand:v1")||"{}").prefs||{};var r=document.documentElement;if(s.theme&&s.theme!=="system")r.dataset.theme=s.theme;if(s.scriptureFont)r.dataset.scriptureFont=s.scriptureFont;if(s.textSize)r.style.setProperty("--scripture-size",s.textSize+"px");if(s.leading)r.style.setProperty("--scripture-leading",String(s.leading));}catch(e){}})();`;
