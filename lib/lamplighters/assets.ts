// Avatars and mascot images, from lib/lamplighters/assets.json (made from assets/ by
// scripts/build-lamplighter-assets.mjs). Profiles store only the avatar's id.

import manifest from "./assets.json";
import mascotConfig from "@/content/mascot.json";

export type Mood = "cheering" | "waving" | "reading" | "gentle";

export interface AvatarAsset {
  id: string;
  src: string;
  alt: string | null;
}

export const AVATARS: readonly AvatarAsset[] = manifest.avatars;

/** null when the id is unknown (a renamed or removed file): show the default avatar. */
export function avatarSrc(id: string | null | undefined): string | null {
  return (id && AVATARS.find((a) => a.id === id)?.src) || null;
}

export function avatarLabel(id: string | null | undefined): string {
  const i = AVATARS.findIndex((a) => a.id === id);
  return i < 0 ? "Default avatar" : (AVATARS[i].alt ?? `Avatar ${i + 1}`);
}

const MASCOT: readonly { src: string; moods: string[] }[] = manifest.mascot;

/** A mascot image for the mood: one tagged with it, else an untagged one, else any. */
export function mascotSrc(mood: Mood, seed = 0): string | null {
  const pool = [MASCOT.filter((m) => m.moods.includes(mood)), MASCOT.filter((m) => m.moods.length === 0), MASCOT].find((p) => p.length > 0);
  return pool ? pool[Math.abs(seed) % pool.length].src : null;
}

type MessageKey = keyof typeof mascotConfig.messages;
export interface MascotMessage {
  title?: string;
  text: string;
  mood: Mood;
}

/** A small stable number from a string, so the same day picks the same message. */
export function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A message from content/mascot.json with {count}, {days} and {book} filled in. */
export function mascotMessage(key: MessageKey, seed: number | string, vars: Record<string, string | number> = {}): MascotMessage {
  const list = mascotConfig.messages[key] as { title?: string; text: string; mood: string }[];
  const m = list[(typeof seed === "string" ? seedOf(seed) : Math.abs(seed)) % list.length];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  return { title: m.title && fill(m.title), text: fill(m.text), mood: m.mood as Mood };
}
