// src/models/Affiliate.ts
import { Schema, model, Types } from 'mongoose';

export type CommissionRule = { minMonthlySales: number; percent: number };

const AffiliateSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', index: true, unique: true, required: true },
  code: { type: String, unique: true, index: true, required: true },   // ?aff=CODE
  active: { type: Boolean, default: true },
  rules: [{ minMonthlySales: Number, percent: Number }],               // sorted asc
  monthKey: { type: String, index: true },                              // YYYY-MM
  monthSales: { type: Number, default: 0 },
  monthOrders: { type: Number, default: 0 },
  monthCommissionAccrued: { type: Number, default: 0 },
  lifetimeSales: { type: Number, default: 0 },
  lifetimeCommission: { type: Number, default: 0 },
  fundAccountId: { type: String, index: true }                          // Razorpay (optional)
}, { timestamps: true });

AffiliateSchema.index({ active: 1, code: 1 });
export default model('Affiliate', AffiliateSchema);
