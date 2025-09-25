// src/utils/tiers.ts
export type AnyTier = { minQty?: any; unitPrice?: any } | { min?: any; price?: any };

export function parsePricingTiers(input: any) {
  if (!input) return [];
  let tiers: AnyTier[] = input;

  // If multipart/form-data sends a string, parse it
  if (typeof input === "string") {
    try { tiers = JSON.parse(input); } catch { tiers = []; }
  }

  if (!Array.isArray(tiers)) return [];

  // Normalize shapes: {minQty, unitPrice} or {min, price}
  const normalized = tiers
    .map((t: AnyTier) => ({
      minQty: Number((t as any).minQty ?? (t as any).min ?? 0),
      unitPrice: Number((t as any).unitPrice ?? (t as any).price ?? 0),
    }))
    .filter((t) => Number.isFinite(t.minQty) && t.minQty > 0 && Number.isFinite(t.unitPrice) && t.unitPrice >= 0);

  // Sort ASC; model will also validate windows (10–40, 50–100)
  normalized.sort((a, b) => a.minQty - b.minQty);

  return normalized;
}
