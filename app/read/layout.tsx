import { TabBar } from "@/components/ui/TabBar";

// The reader is full screen on phones (its own thumb bar); desktop keeps the rail.
export default function ReaderLayout({ children }: LayoutProps<"/read">) {
  return (
    <>
      <div className="min-[960px]:pl-[232px]">{children}</div>
      <TabBar railOnly />
    </>
  );
}
