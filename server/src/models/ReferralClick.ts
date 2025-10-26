import { Schema, model, Types } from 'mongoose';

const ReferralClickSchema = new Schema(
  {
    code: { type: String, index: true },
    refUserId: { type: Types.ObjectId, ref: 'User', index: true },
    ip: String,
    ua: String,
    ts: { type: Date, default: Date.now, index: true },
  },
  { collection: 'referral_clicks' }
);

export default model('ReferralClick', ReferralClickSchema);
