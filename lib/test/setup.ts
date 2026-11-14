import { vi } from "vitest";

// Route code reads chapters and notes through Next.js's "use cache". Outside a running
// Next.js server the directive is a plain string, but cacheLife() throws, so tests make
// it (and cacheTag) do nothing. The files themselves are still read from disk.
vi.mock("next/cache", async (original) => ({
  ...(await original<typeof import("next/cache")>()),
  cacheLife: () => {},
  cacheTag: () => {},
}));
