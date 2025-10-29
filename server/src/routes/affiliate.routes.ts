import { requestAffiliatePayoutSimple, getAffiliatePayoutsAdmin } from '../controllers/affiliateController';
router.post('/payout/simple', authenticate, requestAffiliatePayoutSimple);
router.get('/admin/payouts', authenticate, getAffiliatePayoutsAdmin);
