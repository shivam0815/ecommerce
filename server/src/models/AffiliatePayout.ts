import { Schema, model, Types } from 'mongoose';

const AffiliatePayoutSchema = new Schema({
  affiliateId: { type: Types.ObjectId, ref: 'Affiliate', index: true, required: true },
  userId: { type: Types.ObjectId, ref: 'User', index: true, required: true },
  monthKey: { type: String, index: true, required: true }, // YYYY-MM
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['requested', 'approved', 'paid', 'rejected'],
    default: 'requested',
    index: true
  },
  // 🏦 User-entered payout form fields
  accountHolder: { type: String },
  bankAccount: { type: String },
  ifsc: { type: String },
  bankName: { type: String },
  city: { type: String },
  upiId: { type: String },
  pan: { type: String },
  aadharNumber: { type: String },
  notes: { type: String },
  razorpayPayoutId: { type: String },
  utr: { type: String }
}, { timestamps: true });

// prevent duplicate payout requests per affiliate per month
AffiliatePayoutSchema.index({ affiliateId: 1, monthKey: 1 }, { unique: true });

export default model('AffiliatePayout', AffiliatePayoutSchema);
