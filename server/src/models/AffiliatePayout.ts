// src/models/AffiliatePayout.ts
import { Schema, model, Types } from 'mongoose';

const AffiliatePayoutSchema = new Schema({
  affiliateId: { type: Types.ObjectId, ref: 'Affiliate', index: true, required: true },
  monthKey: { type: String, index: true, required: true }, // YYYY-MM
  amount: { type: Number, required: true },
  status: { type: String, enum: ['requested', 'approved', 'paid', 'rejected'], index: true, default: 'requested' },
  notes: String,
  razorpayPayoutId: { type: String, index: true },
  utr: { type: String }
}, { timestamps: true });

AffiliatePayoutSchema.index({ affiliateId: 1, monthKey: 1 }, { unique: true });
export default model('AffiliatePayout', AffiliatePayoutSchema);
