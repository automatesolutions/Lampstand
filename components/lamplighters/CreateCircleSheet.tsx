"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { createCircle, friendly } from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";

const input = "min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold";

/** Start a Circle (up to 12) or a 1-on-1 Lamplighter pair. */
export function CreateCircleSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"circle" | "pair">("circle");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give it a name.");
    setSaving(true);
    setError("");
    try {
      const id = await createCircle(name, description, kind);
      onOpenChange(false);
      setName("");
      setDescription("");
      router.push(`/circles/${id}`);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New Circle" description="A private group to read the Bible together">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <Segmented
          label="Size"
          value={kind}
          onChange={setKind}
          options={[
            { value: "circle", label: `Circle (up to ${LAMPLIGHTERS.maxMembers})` },
            { value: "pair", label: "Just two of us" },
          ]}
        />
        <p className="text-footnote text-text-secondary">
          {kind === "pair" ? "A 1-on-1 Lamplighter: you and one accountability partner." : "Friends, a small group, your roommates. Invite-only, always private."} You'll invite people next.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LAMPLIGHTERS.circleNameMax} placeholder={kind === "pair" ? "Maria & me" : "Morning Lamps"} className={input} aria-invalid={!!error} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">About it (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LAMPLIGHTERS.circleDescriptionMax}
            rows={2}
            placeholder="Reading the Gospels together this fall"
            className={`${input} resize-none py-3`}
          />
        </label>
        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? "Starting…" : "Start the Circle"}
        </Button>
      </form>
    </Sheet>
  );
}
