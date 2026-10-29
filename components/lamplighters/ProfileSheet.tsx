"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { AVATARS, avatarLabel } from "@/lib/lamplighters/assets";
import { friendly, updateProfile, type LampProfile } from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";
import { Avatar } from "./Avatar";

/** A grid of avatars as a radio group: arrow keys move, Enter or Space picks. */
export function AvatarPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-4 gap-2.5 min-[420px]:grid-cols-5">
      {AVATARS.map((a, i) => {
        const checked = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={avatarLabel(a.id)}
            tabIndex={checked || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(a.id)}
            onKeyDown={(e) => {
              const cols = window.matchMedia("(min-width: 420px)").matches ? 5 : 4;
              const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
              if (!step) return;
              e.preventDefault();
              const j = Math.min(AVATARS.length - 1, Math.max(0, i + step));
              onChange(AVATARS[j].id);
              (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
            }}
            className={`relative grid aspect-square place-items-center rounded-full p-1 transition-shadow ${checked ? "bg-gold-wash ring-2 ring-gold" : "ring-1 ring-transparent"}`}
          >
            <Avatar id={a.id} size={64} className="size-full!" />
            {checked && (
              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid size-6 place-items-center rounded-full bg-gold-strong text-on-gold">
                <span className="icon-[lucide--check] size-4" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  profile: LampProfile | null;
  /** First time: a friendlier title. */
  welcome?: boolean;
  onSaved?: () => void;
}

/** Your name and avatar, as your Circles see them. */
export function ProfileSheet({ open, onOpenChange, userId, profile, welcome = false, onSaved }: Props) {
  const [name, setName] = useState(profile?.display_name ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_id ?? AVATARS[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return setError("Add the name your friends know you by.");
    setSaving(true);
    setError("");
    try {
      await updateProfile(userId, { display_name: clean.slice(0, LAMPLIGHTERS.displayNameMax), avatar_id: avatar });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={welcome ? "Say hi to your Circle" : "Your profile"} description="Your name and avatar, as your Circles see them">
      <form onSubmit={save} className="flex flex-col gap-5 pb-2" noValidate>
        <div className="flex items-center gap-4">
          <Avatar id={avatar} size={84} alt={`Your avatar: ${avatarLabel(avatar)}`} />
          <div className="min-w-0">
            <p className="truncate font-display text-[1.75rem] font-semibold leading-tight">{name.trim() || "Your name"}</p>
            <p className="text-footnote text-text-secondary">This is how your Circles see you. Never your email, unless you choose.</p>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={LAMPLIGHTERS.displayNameMax}
            autoComplete="nickname"
            aria-invalid={!!error}
            aria-describedby={error ? "profile-error" : undefined}
            placeholder="Maria"
            className="min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
          />
        </label>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-caption text-text-secondary">Pick an avatar</legend>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </fieldset>
        {error && (
          <p id="profile-error" role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? "Saving…" : welcome ? "Continue" : "Save"}
        </Button>
      </form>
    </Sheet>
  );
}
