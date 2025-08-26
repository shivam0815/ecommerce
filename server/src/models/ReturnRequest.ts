// models/ReturnRequest.ts
import { Schema, model, Types, Document } from 'mongoose';

export type ReturnStatus =
  | 'pending'            // user submitted; waiting for admin decision
  | 'approved'           // admin approved; waiting for pickup/ship-back
  | 'rejected'           // admin rejected
  | 'pickup_scheduled'   // (optional) pickup created
  | 'in_transit'         // on the way back
  | 'received'           // warehouse received
  | 'refund_initiated'   // refund started
  | 'refund_completed'   // refund finished
  | 'closed'             // done
  | 'cancelled';         // user cancelled before processing

export interface ReturnItem {
  productId: Types.ObjectId;
  orderItemId?: Types.ObjectId;
  name?: string;
  quantity: number;
  unitPrice: number; // snapshot from order
  reason?: string;
}

export interface IReturnRequest extends Document {
  user: Types.ObjectId;
  order: Types.ObjectId;
  status: ReturnStatus;
  reasonType: 'damaged' | 'wrong_item' | 'not_as_described' | 'defective' | 'no_longer_needed' | 'other';
  reasonNote?: string;
  items: ReturnItem[];
  images: string[]; // proof photos
  refundAmount: number;
  currency: string;
  pickupAddress?: {
    name?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  history: { at: Date; by?: Types.ObjectId; action: string; note?: string }[];
  adminNote?: string;
  refund: {
    method?: 'original' | 'wallet' | 'manual';
    reference?: string; // txn id
    at?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<ReturnItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  orderItemId: { type: Schema.Types.ObjectId },
  name: String,
  quantity: { type: Number, min: 1, required: true },
  unitPrice: { type: Number, min: 0, required: true },
  reason: String,
});

const ReturnRequestSchema = new Schema<IReturnRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    status: { type: String, enum: [
      'pending','approved','rejected','pickup_scheduled','in_transit','received','refund_initiated','refund_completed','closed','cancelled'
    ], default: 'pending', index: true },
    reasonType: { type: String, enum: ['damaged','wrong_item','not_as_described','defective','no_longer_needed','other'], required: true },
    reasonNote: String,
    items: { type: [ReturnItemSchema], required: true },
    images: { type: [String], default: [] },
    refundAmount: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'INR' },
    pickupAddress: {
      name: String, phone: String, line1: String, line2: String,
      city: String, state: String, postalCode: String, country: String
    },
    history: [{ at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: 'User' }, action: String, note: String }],
    adminNote: String,
    refund: { method: String, reference: String, at: Date }
  },
  { timestamps: true }
);

export default model<IReturnRequest>('ReturnRequest', ReturnRequestSchema);
