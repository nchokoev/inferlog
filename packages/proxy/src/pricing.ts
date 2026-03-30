// Prices in USD per 1M tokens: { input, output }
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":            { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":       { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":       { input: 10.00, output: 30.00 },
  "o1":                { input: 15.00, output: 60.00  },
  "claude-3-5-sonnet": { input: 3.00,  output: 15.00 },
  "claude-3-5-haiku":  { input: 0.80,  output: 4.00  },
  "claude-3-opus":     { input: 15.00, output: 75.00 },
  "claude-sonnet-4":   { input: 3.00,  output: 15.00 },
};

export function getPricing(model: string): { input: number; output: number } | null {
  if (PRICING[model]) return PRICING[model];
  // Prefix match for versioned model names (e.g. "gpt-4o-2024-08-06" → "gpt-4o")
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (model.startsWith(key)) return pricing;
  }
  return null;
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = getPricing(model);
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output;
}
