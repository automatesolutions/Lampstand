// The speaker colors must stay readable (WCAG AA, 4.5:1) on everything Bible text sits on,
// in Day and Night: the page, the selection, and each highlight color. Reads the real
// tokens from app/globals.css, so changing a color there re-checks it here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const block = (start: string) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));
const DAY = block(":root {");
const NIGHT = block(':root[data-theme="dark"]');
const token = (b: string, name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(b);
  if (!m) throw new Error(`--${name} not found`);
  return m[1];
};

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** `color` painted at `amount` over `base`, as the reader's color-mix() does. */
const over = (color: string, base: string, amount: number) =>
  "#" + rgb(color).map((c, i) => Math.round(c * amount + rgb(base)[i] * (1 - amount)).toString(16).padStart(2, "0")).join("");

for (const [theme, b] of [["Day", DAY], ["Night", NIGHT]] as const) {
  describe(`speaker colors in ${theme}`, () => {
    const bg = token(b, "bg");
    const backgrounds: Record<string, string> = {
      page: bg,
      selection: token(b, "gold-wash"),
      "gold highlight": over(token(b, "gold"), bg, 0.26),
      "blue highlight": over(token(b, "pg-law"), bg, 0.22),
      "green highlight": over(token(b, "pg-history"), bg, 0.24),
      "rose highlight": over(token(b, "pg-gospels"), bg, 0.22),
    };
    for (const speaker of ["speaker-jesus", "speaker-other"]) {
      it(`${speaker} is at least 4.5:1 on every background`, () => {
        for (const [where, color] of Object.entries(backgrounds)) {
          expect(contrast(token(b, speaker), color), `${speaker} on ${where}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
}
