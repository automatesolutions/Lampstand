import { TabBar } from "@/components/ui/TabBar";

// The main tab bar stays on screen in the reader too (DESIGN.md §5.1): at the bottom on
// phones, with the reader's own controls just above it; the side rail from 960px.
export default function ReaderLayout({ children }: LayoutProps<"/read">) {
  return (
    <>
      <div className="min-[960px]:pl-[232px]">{children}</div>
      <TabBar />
    </>
  );
}
