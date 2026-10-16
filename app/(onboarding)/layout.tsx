export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-bg-soft px-gutter pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] sm:bg-transparent">
      {children}
    </main>
  );
}
