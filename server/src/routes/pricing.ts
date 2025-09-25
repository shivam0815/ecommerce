// src/routes/pricing.ts
import { Router } from 'express';
import Product from '../models/Product';
import { quoteFixedWindows } from '../config/price';
import { authenticate} from '../middleware/auth'; // adjust if your path/name differs

const router = Router();

/**
 * POST /api/pricing/quote/:id
 * body: { qty: number, withTax?: boolean }
 * returns: { normalizedQty, slab, unitPriceExGST, unitPrice, gstRate, overLimit }
 */
router.post('/pricing/quote/:id', authenticate, async (req, res) => {
  try {
    const { qty = 10, withTax = false } = req.body || {};
    const product = await Product.findById(req.params.id).select('+gst').lean(); // gst is select:false in model
    if (!product) return res.status(404).json({ error: 'Not found' });

    const quote = quoteFixedWindows(
      product.price,
      product.pricingTiers || [],
      Number(qty),
      {
        moq: 10,                       // global MOQ 10 (you can switch to product.minOrderQtyOverride ?? 10)
        step: product.incrementStep ?? 10,
        gst: product.gst ?? 18,
        withTax: !!withTax,
        ceil: true
      }
    );

    return res.json(quote);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
