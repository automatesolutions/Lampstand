"use client";

import { Segmented } from "@/components/ui/Segmented";
import { VERSIONS } from "@/lib/bible/provider";
import type { VersionId } from "@/lib/bible/types";
import { LEADINGS, setPrefs, TEXT_SIZES, useStore, type ScriptureFont, type Theme } from "@/lib/store";

const LEADING_LABELS = ["Snug", "Easy", "Airy"] as const;

const READABLE = VERSIONS.filter((v) => v.available);

interface Props {
  preview?: boolean;
  /** The reader passes the version on screen and switches the page; elsewhere it is the saved preference. */
  version?: VersionId;
  onVersionChange?: (id: VersionId) => void;
}

/** Version, text size, line spacing, scripture font and theme. Used in the reader's Text sheet and on Me. */
export function ReaderSettings({ preview = false, version, onVersionChange }: Props) {
  const prefs = useStore((s) => s.prefs);
  const i = Math.max(0, TEXT_SIZES.indexOf(prefs.textSize as (typeof TEXT_SIZES)[number]));

  return (
    <div className="flex flex-col gap-5">
      {preview && (
        <p className="scripture rounded-md bg-bg p-4">For God so loved the world, that he gave his only begotten Son…</p>
      )}
      {READABLE.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-caption text-text-secondary">Version</span>
          <Segmented<VersionId>
            label="Version"
            value={version ?? prefs.version}
            onChange={(id) => (onVersionChange ? onVersionChange(id) : setPrefs({ version: id }))}
            options={READABLE.map((v) => ({ value: v.id, label: v.id }))}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span id="text-size-label" className="text-caption text-text-secondary">
          Text size
        </span>
        <div role="group" aria-labelledby="text-size-label" className="grid grid-cols-[56px_1fr_56px] items-center gap-2">
          <button type="button" aria-label="Smaller text" disabled={i === 0} onClick={() => setPrefs({ textSize: TEXT_SIZES[i - 1] })} className="h-14 rounded-[16px] bg-surface font-display text-[1rem] font-semibold text-gold-text disabled:opacity-35">
            A
          </button>
          <span aria-live="polite" className="text-center text-headline tabular-nums">
            {prefs.textSize} px
          </span>
          <button type="button" aria-label="Larger text" disabled={i === TEXT_SIZES.length - 1} onClick={() => setPrefs({ textSize: TEXT_SIZES[i + 1] })} className="h-14 rounded-[16px] bg-surface font-display text-[1.6rem] font-semibold text-gold-text disabled:opacity-35">
            A
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-text-secondary">Line spacing</span>
        <Segmented<string>
          label="Line spacing"
          value={String(prefs.leading)}
          onChange={(v) => setPrefs({ leading: Number(v) })}
          options={LEADINGS.map((l, n) => ({ value: String(l), label: LEADING_LABELS[n] }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-text-secondary">Font</span>
        <Segmented<ScriptureFont>
          label="Font"
          value={prefs.scriptureFont}
          onChange={(scriptureFont) => setPrefs({ scriptureFont })}
          options={[
            { value: "serif", label: "Serif" },
            { value: "sans", label: "Sans" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-caption text-text-secondary">Appearance</span>
        <Segmented<Theme>
          label="Appearance"
          value={prefs.theme}
          onChange={(theme) => setPrefs({ theme })}
          options={[
            { value: "light", label: "Day" },
            { value: "dark", label: "Night" },
            { value: "system", label: "Auto" },
          ]}
        />
      </div>
    </div>
  );
}
