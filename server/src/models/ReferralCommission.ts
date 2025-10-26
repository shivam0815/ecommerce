import { Schema, model, Types } from 'mongoose';

const ReferralCommissionSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: 'Order', unique: true },
    refUserId: { type: Types.ObjectId, ref: 'User', index: true },
    buyerUserId: { type: Types.ObjectId, ref: 'User' },
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'paid'], index: true },
    createdAt: { type: Date, default: Date.now },
    approvedAt: Date,
    paidAt: Date,
  },
  { collection: 'referral_commissions' }
);

export default model('ReferralCommission', ReferralCommissionSchema);
