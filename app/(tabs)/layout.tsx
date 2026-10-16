import { TabBar } from "@/components/ui/TabBar";

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-[680px] px-gutter pb-[calc(56px+env(safe-area-inset-bottom)+40px)] pt-[calc(env(safe-area-inset-top)+28px)] min-[960px]:ml-[232px] min-[960px]:w-[calc(100%-232px)] min-[960px]:max-w-none min-[960px]:pb-16 min-[960px]:pt-12">
        <div className="mx-auto w-full max-w-[680px] has-[[data-wide]]:max-w-[960px]">{children}</div>
      </main>
      <TabBar />
    </>
  );
}
