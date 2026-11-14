import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Development only: lets a phone or another computer on the same Wi-Fi open the dev
  // server by its network address (http://192.168.x.x:3000). Without it Next.js blocks its
  // own scripts there, and pages show only what the server drew (no Today, no lamp).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
