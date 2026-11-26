import type { MetadataRoute } from "next";

// Lets phones and desktop Chrome or Edge install Lampstand. The icons are made by
// scripts/build-icons.mjs. The dark page color matches the icon on the Android splash
// screen; the theme color in app/layout.tsx follows light or dark once the app is open.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lampstand",
    short_name: "Lampstand",
    description: "Read the Bible daily and understand what you read.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#16120d",
    theme_color: "#16120d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
