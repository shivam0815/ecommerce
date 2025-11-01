import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  requestAffiliatePayoutSimple,
  getAffiliatePayoutsAdmin,
} from '../controllers/affiliateController';

const router = Router();

router.post('/request-payout', authenticate, requestAffiliatePayoutSimple);
router.post('/payout/simple', authenticate, requestAffiliatePayoutSimple);
router.get('/admin/payouts', authenticate, getAffiliatePayoutsAdmin);


export default router;
