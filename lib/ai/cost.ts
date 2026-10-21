// What a Claude API request cost, from the usage the API reports.
// Anthropic list prices in US$ per million tokens (October 2026). Update if they change.

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: Usage): number {
  // Unknown model: price it like Opus so the cap errs on the safe side.
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (u.input_tokens * p.input + u.output_tokens * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
}
