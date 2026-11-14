import type { HighlightColor } from "@/lib/store";

// Highlight colors as they're shown (DESIGN.md §2): stored names, the label people read
// and hear, and the pigment that fills the swatch. One list for every screen.
export const SWATCH: Record<HighlightColor, { label: string; fill: string }> = {
  gold: { label: "Gold", fill: "var(--gold)" },
  sky: { label: "Blue", fill: "var(--pg-law)" },
  sage: { label: "Green", fill: "var(--pg-history)" },
  rose: { label: "Rose", fill: "var(--pg-gospels)" },
};
