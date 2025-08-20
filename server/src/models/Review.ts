// models/Review.ts
import { Schema, model, Types } from 'mongoose';

export interface IReview {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  userId: Types.ObjectId;
  userName: string;
  rating: number;            // 1..5
  comment: string;
  verified: boolean;         // “verified purchase”
  status: 'pending' | 'approved' | 'rejected';
  helpful: number;
  reviewDate: Date;
}

const ReviewSchema = new Schema<IReview>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, trim: true, default: '' },
  verified: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  helpful: { type: Number, default: 0 },
  reviewDate: { type: Date, default: Date.now }
}, { timestamps: true });

// one review per user per product
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default model<IReview>('Review', ReviewSchema);
