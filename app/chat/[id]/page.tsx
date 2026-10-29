import { Suspense } from "react";
import { ChatScreen } from "@/components/lamplighters/ChatScreen";

export const metadata = { title: "Chat" };

// Full screen like the reader: no tab bar, the composer sits at the bottom.
export default function ChatPage({ params }: PageProps<"/chat/[id]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-bg" />}>
      {params.then(({ id }) => (
        <ChatScreen id={id} />
      ))}
    </Suspense>
  );
}
