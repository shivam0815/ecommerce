// routes/shipping.ts
import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { setPackageAndMaybeLink, createShippingPaymentLink } from '../controllers/shippingController';

const router = express.Router();
const guard = [authenticate, authorize(['admin','super_admin'])] as const;

// ✅ match the FE
router.put('/:id/shipping/package', ...guard, setPackageAndMaybeLink);
router.post('/:id/shipping/payment-link', ...guard, createShippingPaymentLink);

// (optional) backward-compat aliases to avoid breaking any old callers
router.patch('/:id/package', ...guard, setPackageAndMaybeLink);
router.post('/:id/shipping-link', ...guard, createShippingPaymentLink);

export default router;
