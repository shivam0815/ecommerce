// src/jobs/affiliateCloseMonth.ts
import dayjs from 'dayjs';
import AffiliateAttribution from '../models/AffiliateAttribution';
import AffiliatePayout from '../models/AffiliatePayout';

export async function closePreviousMonth() {
  const prev = dayjs().subtract(1, 'month').format('YYYY-MM');
  const aggs = await AffiliateAttribution.aggregate([
    { $match: { monthKey: prev, status: 'pending' } },
    { $group: { _id: '$affiliateId', commission: { $sum: '$commissionAmount' } } }
  ]);

  for (const g of aggs) {
    await AffiliateAttribution.updateMany(
      { affiliateId: g._id, monthKey: prev, status: 'pending' },
      { $set: { status: 'locked' } }
    );
    await AffiliatePayout.updateOne(
      { affiliateId: g._id, monthKey: prev },
      { $setOnInsert: { amount: g.commission, status: 'requested' } },
      { upsert: true }
    );
  }
}
