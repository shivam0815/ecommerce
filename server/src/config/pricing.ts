// src/utils/pricing.ts
/**
 * Return the correct unit price for a given product *and* quantity.
 * Works with both full mongoose docs (with getUnitPriceForQty) and plain objects.
 */
export function resolveUnitPrice(product: any, qty: number): number {
  if (!product) return 0;

  // If it's a mongoose doc with your method:
  if (typeof product.getUnitPriceForQty === "function") {
    return product.getUnitPriceForQty(qty);
  }

  const base = Number(product?.price ?? 0);
  const tiers = Array.isArray(product?.pricingTiers) ? product.pricingTiers : [];
  if (!tiers.length) return base;

  // tiers should already be sorted asc by minQty (your pre-validate does this)
  let unit = base;
  for (const t of tiers) {
    const minQty = Number(t?.minQty ?? 0);
    const unitPrice = Number(t?.unitPrice ?? t?.price ?? base);
    if (qty >= minQty) unit = unitPrice;
    else break;
  }
  return unit;
}
