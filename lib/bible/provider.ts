import type { Chapter, ChapterRef, VersionId, VersionInfo } from "./types";

/**
 * Every Bible version sits behind this interface. The UI never talks to a
 * specific source, so a licensed API (API.Bible, publisher APIs) can be added
 * as a new provider without UI changes.
 */
export interface BibleProvider {
  readonly id: VersionId;
  chapter(ref: ChapterRef): Promise<Chapter | null>;
}

export const VERSIONS: readonly VersionInfo[] = [
  { id: "KJV", name: "King James Version", available: true, copyright: "Public domain." },
  { id: "NKJV", name: "New King James Version", available: false, copyright: "© Thomas Nelson." },
  {
    id: "ESV",
    name: "English Standard Version",
    available: true,
    // Crossway requires this notice and a link to esv.org on every page showing ESV text.
    copyright: "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.",
    link: { href: "https://www.esv.org", label: "www.esv.org" },
  },
  {
    id: "NLT",
    name: "New Living Translation",
    available: true,
    // Tyndale's required notice.
    copyright: "Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.",
  },
  { id: "NABRE", name: "New American Bible, Revised Edition", available: false, copyright: "© Confraternity of Christian Doctrine." },
];

export function versionFromSlug(slug: string): VersionInfo | undefined {
  return VERSIONS.find((v) => v.id.toLowerCase() === slug.toLowerCase());
}

export function versionSlug(id: VersionId): string {
  return id.toLowerCase();
}
