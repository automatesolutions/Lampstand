import { describe, expect, it } from "vitest";
import { costUsd } from "./cost";

describe("costUsd", () => {
  it("prices a typical prayer on Sonnet 5.5", () => {
    // 1,200 in, 300 out: $0.0024 + $0.003
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1200, output_tokens: 300 })).toBeCloseTo(0.0054, 6);
  });

  it("counts cache reads and writes", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(5.2, 6);
  });

  it("prices an unknown model like Opus, to stay on the safe side", () => {
    expect(costUsd("claude-something-new", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(4);
  });
});
