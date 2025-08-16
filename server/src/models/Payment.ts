import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentModel extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
  paymentDate: Date;
  orderId: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema({
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
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  paymentMethod: { 
    type: String, 
    required: true,
    enum: ['razorpay', 'stripe', 'paypal', 'upi', 'card', 'netbanking', 'wallet']
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed', 'refunded'],
    required: true,
    default: 'pending'
  },
  transactionId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  orderId: { 
    type: String, 
    required: true,
    ref: 'Order'
  }
}, {
  timestamps: true
});

// Indexes for better performance
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ transactionId: 1 });
PaymentSchema.index({ status: 1, paymentDate: -1 });
PaymentSchema.index({ paymentDate: -1 });

export default mongoose.model<IPaymentModel>('Payment', PaymentSchema);
