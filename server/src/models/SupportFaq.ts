import mongoose, { Schema, Document } from 'mongoose';

export interface ISupportFaq extends Document {
  question: string;
  answer: string;
  category?: string;
  isActive: boolean;
  order: number;
}

const SupportFaqSchema = new Schema<ISupportFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SupportFaqSchema.index({ isActive: 1, order: 1 });
SupportFaqSchema.index({ question: 'text', answer: 'text', category: 'text' });

export default mongoose.model<ISupportFaq>('SupportFaq', SupportFaqSchema);
