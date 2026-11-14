import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Server code imports "server-only" to keep it out of the browser; tests run in Node.
      "server-only": fileURLToPath(new URL("./lib/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    setupFiles: ["lib/test/setup.ts"],
  },
});
