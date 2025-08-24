import { Schema, model, Types } from 'mongoose';

export type NotificationType =
  | 'order'
  | 'promo'
  | 'system'
  | 'product'
  | 'announcement';

const NotificationSchema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['order', 'promo', 'system', 'product', 'announcement'],
      default: 'system',
    },
    // who can see it
    audience: { type: String, enum: ['all', 'user'], default: 'user' },
    userId: { type: Types.ObjectId, ref: 'User' }, // required if audience === 'user'
    // read state (for user-scoped items)
    isRead: { type: Boolean, default: false },
    // optional call-to-action
    cta: {
      label: { type: String },
      href: { type: String },
    },
  },
  { timestamps: true }
);

export default model('Notification', NotificationSchema);
