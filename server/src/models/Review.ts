// src/models/Review.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId | string;   // tolerate legacy string ids
  productName?: string;
  userId?: mongoose.Types.ObjectId;              // optional (omit if anonymous)
  userName?: string;
  userEmail?: string;
  rating: number;                                // 1..5
  title?: string;
  comment: string;
  verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  helpful: number;
  reviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false }, // ⚠️ not required
    userName: { type: String, trim: true },
    userEmail: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: { type: String, trim: true },
    comment: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    helpful: { type: Number, default: 0 },
    reviewDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/** 🚫 NO UNIQUE INDEXES HERE.  */
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 }, { sparse: true }); // non-unique, just for lookup

export default mongoose.model<IReview>('Review', ReviewSchema);
