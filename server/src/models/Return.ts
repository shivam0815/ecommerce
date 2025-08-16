import mongoose, { Schema, Document } from 'mongoose';

export interface IReturn extends Document {
  _id: mongoose.Types.ObjectId;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  userEmail: string;
  returnReason: string;
  returnDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  refundAmount: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnSchema: Schema = new Schema({
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
  userEmail: { 
    type: String, 
    required: true,
    lowercase: true
  },
  returnReason: { 
    type: String, 
    required: true,
    maxlength: 500
  },
  returnDate: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'processed'],
    default: 'pending'
  },
  refundAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  imageUrl: { 
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ReturnSchema.index({ userId: 1, status: 1 });
ReturnSchema.index({ productId: 1 });
ReturnSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IReturn>('Return', ReturnSchema);
