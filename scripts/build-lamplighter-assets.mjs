// Builds the avatar and mascot images from assets/ for the app.
//
//   node scripts/build-lamplighter-assets.mjs     (runs on its own before `npm run dev`)
//
// Every .png / .jpg / .jpeg / .webp in assets/avatars and assets/mascot becomes a small
// WebP in public/lamplighters/, and lib/lamplighters/assets.json lists them. Commit both:
// the Docker build doesn't include scripts/ or assets/.
//
// - An avatar's id is its file name in kebab case, so renaming a file changes its id
//   (people who chose it get the default avatar until they pick again).
// - Mascot moods come from the file name: cheer, wave, read, gentle (see MOODS below).
//   A file without a mood word can stand in for any mood.
// - Optional alt text: a labels.json beside the images, { "file-name.png": "Smiling lamp waving" }.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "lamplighters");
const MANIFEST = join(ROOT, "lib", "lamplighters", "assets.json");
const IMAGE = /\.(png|jpe?g|webp)$/i;

const MOODS = {
  cheering: /cheer|celebrat|party|yay|thumb/i,
  waving: /wave|waving|hello|hi-|welcome/i,
  reading: /read|book|study|glasses/i,
  gentle: /gentle|calm|hug|rest|soft|sleep/i,
};

const kebab = (name) =>
  name
    .replace(extname(name), "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";

function labels(dir) {
  const file = join(dir, "labels.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    console.warn(`  ${file} isn't valid JSON; ignoring it.`);
    return {};
  }
}

async function build(kind, { width, height, fit }) {
  const dir = join(ROOT, "assets", kind);
  const out = join(OUT, kind);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  if (!existsSync(dir)) return [];

  const alt = labels(dir);
  const seen = new Set();
  const items = [];
  for (const file of readdirSync(dir).filter((f) => IMAGE.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
    let id = kebab(file);
    for (let i = 2; seen.has(id); i++) id = `${kebab(file)}-${i}`;
    seen.add(id);

    const webp = await sharp(join(dir, file)).resize({ width, height, fit, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const hash = createHash("sha256").update(webp).digest("hex").slice(0, 8); // new file name when the image changes
    const name = `${id}.${hash}.webp`;
    writeFileSync(join(out, name), webp);

    const item = { id, src: `/lamplighters/${kind}/${name}`, file, alt: alt[file] ?? null };
    if (kind === "mascot") item.moods = Object.entries(MOODS).filter(([, re]) => re.test(file)).map(([mood]) => mood);
    items.push(item);
  }
  return items;
}

const avatars = await build("avatars", { width: 256, height: 256, fit: "cover" });
const mascot = await build("mascot", { width: 640, height: 640, fit: "inside" });
writeFileSync(MANIFEST, JSON.stringify({ avatars, mascot }, null, 2) + "\n");
console.log(`Lamplighters assets: ${avatars.length} avatars, ${mascot.length} mascot images.`);
