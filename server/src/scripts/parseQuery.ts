export type ParsedFilters = {
  q: string;
  minPrice?: number;
  maxPrice?: number;
  requireFeatures?: string[];   // NEW
  categoryHint?: string | null; // NEW
};

export function parseUserQuery(message: string): ParsedFilters {
  const text = message.toLowerCase();

  // price
  const under = text.match(/\b(under|below|upto|up to)\s*₹?\s*(\d{2,7})\b/);
  const between = text.match(/\b(between|from)\s*₹?\s*(\d{2,7})\s*(and|-|to)\s*₹?\s*(\d{2,7})\b/);
  const lt = text.match(/\b(<|<=)\s*₹?\s*(\d{2,7})\b/);
  const gt = text.match(/\b(>|>=)\s*₹?\s*(\d{2,7})\b/);

  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  if (between) {
    const a = Number(between[2]), b = Number(between[4]);
    minPrice = Math.min(a, b); maxPrice = Math.max(a, b);
  } else if (under) {
    maxPrice = Number(under[2]);
  } else {
    if (lt) maxPrice = Number(lt[2]);
    if (gt) minPrice = Number(gt[2]);
  }

  // feature tokens
  const requireFeatures: string[] = [];
  if (/\b3a\b/.test(text) || /\b3 amp\b/.test(text)) requireFeatures.push("3a");
  if (/\bfast( |-)?charge(r|)?\b/.test(text)) requireFeatures.push("fast");
  if (/\bqc( ?[23]\.?\d*)?\b/.test(text)) requireFeatures.push("qc"); // qc, qc3.0
  if (/\bpd( ?\d+(\.\d+)?)?\b/.test(text)) requireFeatures.push("pd"); // pd, pd3.0
  const w = text.match(/\b(\d{2,3})\s*w\b/); // 18w, 20w, 33w
  if (w) requireFeatures.push(`${w[1]}w`);

  // category hint
  let categoryHint: string | null = null;
  if (/\b(charger|charging adapter|wall adapter|power adapter)\b/.test(text)) {
    categoryHint = "charger";
  } else if (/\b(cable|data cable|type[- ]?(c|a|micro))\b/.test(text)) {
    categoryHint = "data cable";
  }

  return { q: message.trim(), minPrice, maxPrice, requireFeatures, categoryHint };
}
