import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWishlist extends Document {
  userId: Types.ObjectId;
  items: Array<{
    productId: Types.ObjectId;
    addedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Ensure no duplicate products in wishlist
WishlistSchema.index({ userId: 1, 'items.productId': 1 }, { unique: true });

export default mongoose.model<IWishlist>('Wishlist', WishlistSchema);
