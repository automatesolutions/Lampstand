// Builds the site icons and the link preview image from the lamp mark
// (components/brand/LampMark.tsx), in the dark theme's colors.
// Run: node scripts/build-icons.mjs. Writes app/favicon.ico, app/icon.png,
// app/apple-icon.png and app/opengraph-image.png (Next.js picks these up by name).

import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const C = { bg: "#16120d", gold: "#dcaf55", leaf1: "#f0cd7a", leaf2: "#b8862c", leaf3: "#ffe3a1", text: "#f3e9d6", muted: "#bfae92" };
const FLAME = "M40 9c3.6 4.2 5.4 7.6 5.4 10.4a5.4 5.4 0 0 1-10.8 0C34.6 16.6 36.4 13.2 40 9Z";
const CORE = "M40 15.5c1.5 1.9 2.2 3.3 2.2 4.4a2.2 2.2 0 0 1-4.4 0c0-1.1.7-2.5 2.2-4.4Z";
const BODY =
  "M8 36c0-3.3 7.6-6 20-6h6.5c2.2 0 3.4-1 4.6-2.6L40 26l1 1.6c.8 1.4.2 3.1-1.2 3.9l-2.3 1.2c4.5 1.2 7.5 2.9 7.5 4.8 0 5.5-8.6 10.5-19 10.5S8 42.6 8 36Z";

const defs = `<defs>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.leaf3}"/><stop offset=".45" stop-color="${C.leaf1}"/><stop offset="1" stop-color="${C.leaf2}"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="rgb(240,180,70)" stop-opacity=".45"/><stop offset="1" stop-color="rgb(240,180,70)" stop-opacity="0"/></radialGradient>
</defs>`;

/** The lamp in a 64-unit box. Small sizes get thicker lines so it still reads. */
const lamp = (stroke = 2.25) => `
  <circle cx="38" cy="24" r="26" fill="url(#glow)"/>
  <g fill="none" stroke="${C.gold}" stroke-linejoin="round" stroke-linecap="round">
    <path d="${BODY}" stroke-width="${stroke}"/>
    <ellipse cx="22" cy="35" rx="5" ry="1.8" stroke-width="${stroke * 0.9}"/>
    <path d="M19 50.5h16" stroke-width="${stroke}"/>
  </g>
  <path d="${FLAME}" fill="url(#leaf)"/>
  <path d="${CORE}" fill="${C.bg}" opacity=".7"/>`;

/** A square app icon: the lamp on the dark page, rounded unless iOS rounds it itself. */
const iconSvg = (size, { rounded = true, stroke = 2.25 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs}
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${C.bg}"/>
  <g transform="translate(5.5 3) scale(.86)">${lamp(stroke)}</g></svg>`;

const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

/** An .ico holding PNG images (every current browser reads these). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${defs}
  <rect width="1200" height="630" fill="${C.bg}"/>
  <circle cx="600" cy="220" r="260" fill="url(#glow)"/>
  <g transform="translate(470 40) scale(4.1)">${lamp(2.1)}</g>
  <text x="600" y="430" text-anchor="middle" font-family="Cormorant Garamond, Cormorant, Georgia, 'Times New Roman', serif" font-size="96" font-weight="600" fill="${C.text}">Lampstand</text>
  <path d="M470 470h100M630 470h100" stroke="${C.gold}" stroke-opacity=".45" stroke-width="2"/>
  <path d="M600 461c1.6 2.4 1.6 4.6 0 6-1.6-1.4-1.6-3.6 0-6zM600 473c-2-3-5.5-4-9.5-3 2.5-2 6.5-2 9.5 1 3-3 7-3 9.5-1-4-1-7.5 0-9.5 3z" fill="${C.gold}" transform="translate(-12 -9) scale(1.02)"/>
  <text x="600" y="540" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" fill="${C.muted}">Read the Bible each day, and understand what you read.</text>
</svg>`;

const [i16, i32, i48] = await Promise.all([png(iconSvg(16, { stroke: 3.6 })), png(iconSvg(32, { stroke: 3 })), png(iconSvg(48, { stroke: 2.7 }))]);
await writeFile("app/favicon.ico", ico([{ size: 16, data: i16 }, { size: 32, data: i32 }, { size: 48, data: i48 }]));
await writeFile("app/icon.png", await png(iconSvg(512)));
await writeFile("app/apple-icon.png", await png(iconSvg(180, { rounded: false })));
await writeFile("app/opengraph-image.png", await png(og));
console.log("Icons written: app/favicon.ico, app/icon.png, app/apple-icon.png, app/opengraph-image.png");
