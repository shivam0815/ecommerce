// src/utils/price.ts
export function quoteFixedWindows(
  basePrice: number,
  tiers: { minQty: number; unitPrice: number }[] = [],
  qty: number,
  opts: { gst?: number; withTax?: boolean; moq?: number; step?: number; ceil?: boolean } = {}
) {
  const moq  = opts.moq  ?? 10;   // minimum order qty
  const step = opts.step ?? 10;   // multiples of 10
  const ceil = opts.ceil ?? true; // true = always round up
  const gst  = opts.gst  ?? 18;

  // normalize qty to MOQ & step (ceil policy: 63 -> 70)
  const normalize = (q: number) => {
    const min = Math.max(1, moq);
    if (!q || q < min) return min;
    const m = ceil ? Math.ceil(q / step) : Math.round(q / step);
    return Math.max(min, m * step);
  };

  const q = normalize(qty);

  // find admin-set prices for windows (admin will store two entries: minQty 10 and 50)
  const price10_40  = tiers.find(t => t.minQty >= 10 && t.minQty <= 40)?.unitPrice ?? basePrice;
  const price50_100 = tiers.find(t => t.minQty >= 50 && t.minQty <= 100)?.unitPrice ?? basePrice;

  let unitEx = basePrice;
  let slab   = 'base';
  if (q >= 10 && q <= 40)      { unitEx = price10_40;  slab = '10-40'; }
  else if (q >= 50 && q <= 100){ unitEx = price50_100; slab = '50-100'; }
  else if (q > 100)            { unitEx = basePrice;   slab = '>100'; } // UI will handle WA flow

  const unit = opts.withTax ? Number((unitEx * (1 + gst / 100)).toFixed(2)) : unitEx;

  return {
    normalizedQty: q,
    slab,
    unitPriceExGST: unitEx,
    unitPrice: unit,
    gstRate: gst,
    overLimit: q > 100, // >100 => hide cart/buy; show WhatsApp CTA
  };
}
