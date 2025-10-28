// src/models/AffiliateAttribution.ts
import { Schema, model, Types } from 'mongoose';

const AffiliateAttributionSchema = new Schema({
  affiliateId: { type: Types.ObjectId, ref: 'Affiliate', index: true, required: true },
  clickId: { type: String, index: true },
  orderId: { type: Types.ObjectId, ref: 'Order', index: true, required: true },
  orderNumber: { type: String, index: true },
  amount: { type: Number, required: true },             // eligible subtotal
  commissionPercent: { type: Number, required: true },  // e.g. 1.25
  commissionAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'locked', 'reversed'], index: true, default: 'pending' },
  reason: { type: String },
  monthKey: { type: String, index: true }               // YYYY-MM
}, { timestamps: true });

AffiliateAttributionSchema.index({ affiliateId: 1, monthKey: 1, status: 1 });
export default model('AffiliateAttribution', AffiliateAttributionSchema);
