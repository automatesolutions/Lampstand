import { LampMark } from "@/components/brand/LampMark";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-6 px-gutter text-center">
      <LampMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title-1">This page isn’t here</h1>
        <p className="text-body text-text-secondary">The link may be wrong, or the version isn’t available yet.</p>
      </div>
      <ButtonLink href="/" variant="primary">
        Go to Today
      </ButtonLink>
    </main>
  );
}
