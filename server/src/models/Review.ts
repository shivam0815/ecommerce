// backend/src/models/Review.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  userEmail?: string;
  rating: number;          // 1..5
  title?: string;
  comment: string;
  verified: boolean;       // you can set true for verified purchases
  status: 'pending' | 'approved' | 'rejected';
  helpfuls: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId:    { type: Schema.Types.ObjectId, ref: 'User' },
    userName:  { type: String },
    userEmail: { type: String },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    title:     { type: String },
    comment:   { type: String, required: true, trim: true },
    verified:  { type: Boolean, default: false },
    status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    helpfuls:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

// models/Review.ts
export default (mongoose.models.Review as mongoose.Model<IReview>) ||
  mongoose.model<IReview>('Review', ReviewSchema);


