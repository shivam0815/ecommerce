import mongoose, { Schema, Document } from 'mongoose';

export interface IReviewModel extends Document {
  _id: mongoose.Types.ObjectId;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema: Schema = new Schema({
  productId: { 
    type: String, 
    required: true,
    ref: 'Product'
  },
  productName: { 
    type: String, 
    required: true 
  },
  userId: { 
    type: String, 
    required: true,
    ref: 'User'
  },
  userName: { 
    type: String, 
    required: true 
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  },
  comment: { 
    type: String, 
    required: true,
    maxlength: 1000
  },
  reviewDate: { 
    type: Date, 
    default: Date.now 
  },
  helpful: { 
    type: Number, 
    default: 0,
    min: 0
  },
  verified: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: true
});

// Indexes for better performance
ReviewSchema.index({ productId: 1, rating: -1 });
ReviewSchema.index({ userId: 1 });
ReviewSchema.index({ verified: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });

export default mongoose.model<IReviewModel>('Review', ReviewSchema);
