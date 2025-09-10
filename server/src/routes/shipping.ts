import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { setPackageAndMaybeLink, createShippingPaymentLink } from '../controllers/shippingController';

const router = express.Router();

router.patch('/:id/package', authenticate, authorize(['admin','super_admin']), setPackageAndMaybeLink);
router.post('/:id/shipping-link', authenticate, authorize(['admin','super_admin']), createShippingPaymentLink);

export default router;
