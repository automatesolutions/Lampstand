import { Suspense } from "react";
import { SoloScreen } from "@/components/quiz/SoloScreen";

export const metadata = { title: "Bible challenge" };

// A challenge played on your own time. Full screen like chat.
export default function SoloPage({ params }: PageProps<"/challenge/set/[id]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-bg" />}>
      {params.then(({ id }) => (
        <SoloScreen id={id} />
      ))}
    </Suspense>
  );
}
