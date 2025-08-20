import mongoose, { Schema, Document } from 'mongoose';

export interface INewsletterSubscriber extends Document {
  email: string;
  verified: boolean;
  token?: string | null;
  subscribedAt: Date;
  verifiedAt?: Date | null;
  ip?: string | null;
  source?: string | null;
}

const NewsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    verified: { type: Boolean, default: false, index: true },
    token: { type: String, default: null, index: true },
    subscribedAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date, default: null },
    ip: { type: String, default: null },
    source: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<INewsletterSubscriber>('NewsletterSubscriber', NewsletterSubscriberSchema);
