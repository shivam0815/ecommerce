import mongoose, { Schema } from 'mongoose';
import { IReview } from '../types';

const reviewSchema = new Schema<IReview>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Ensure one review per user per product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export default mongoose.model<IReview>('Review', reviewSchema);