// src/utils/parseQuery.ts
export type ParsedFilters = {
  q: string;
  minPrice?: number;
  maxPrice?: number;
};

export function parseUserQuery(message: string): ParsedFilters {
  const text = message.toLowerCase();

  // price: "under 200", "below 300", "upto 500", "under ₹300"
  const under = text.match(/\b(under|below|upto|up to)\s*₹?\s*(\d{2,7})\b/);
  const between = text.match(/\b(between|from)\s*₹?\s*(\d{2,7})\s*(and|-|to)\s*₹?\s*(\d{2,7})\b/);
  const lessThan = text.match(/\b(<|<=)\s*₹?\s*(\d{2,7})\b/);
  const greaterThan = text.match(/\b(>|>=)\s*₹?\s*(\d{2,7})\b/);

  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  if (between) {
    const a = Number(between[2]);
    const b = Number(between[4]);
    minPrice = Math.min(a, b);
    maxPrice = Math.max(a, b);
  } else if (under) {
    maxPrice = Number(under[2]);
  } else {
    if (lessThan) maxPrice = Number(lessThan[2]);
    if (greaterThan) minPrice = Number(greaterThan[2]);
  }

  // Use the whole message as q (works with text index / Atlas Search)
  const q = message.trim();

  return { q, minPrice, maxPrice };
}
