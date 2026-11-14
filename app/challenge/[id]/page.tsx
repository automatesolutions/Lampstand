import { Suspense } from "react";
import { GameScreen } from "@/components/quiz/GameScreen";

export const metadata = { title: "Bible challenge" };

// Full screen like chat: no tab bar while playing. Games are private, loaded in the browser.
export default function GamePage({ params }: PageProps<"/challenge/[id]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-bg" />}>
      {params.then(({ id }) => (
        <GameScreen id={id} />
      ))}
    </Suspense>
  );
}
