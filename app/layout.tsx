import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Hanken_Grotesk, Literata } from "next/font/google";
import { LampDefs } from "@/components/brand/LampMark";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { ExplainSheet } from "@/components/explain/ExplainSheet";
import { PrayerSheet } from "@/components/prayer/PrayerSheet";
import { SyncAgent } from "@/components/SyncAgent";
import { ThemeSync, themeBootScript } from "@/components/ThemeSync";
import "./globals.css";

// The three faces of the illuminated page (DESIGN.md §3), self-hosted.
const display = Cormorant_Garamond({
  variable: "--ff-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const literata = Literata({
  variable: "--ff-literata",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});
const ui = Hanken_Grotesk({
  variable: "--ff-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Lampstand", template: "%s · Lampstand" },
  description: "Read the Bible daily and understand what you read.",
  applicationName: "Lampstand",
  appleWebApp: { title: "Lampstand", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#16120d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${literata.variable} ${ui.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-dvh">
        <ThemeSync />
        <SyncAgent />
        <LampDefs />
        {children}
        <CommandPalette />
        <PrayerSheet />
        <ExplainSheet />
      </body>
    </html>
  );
}
