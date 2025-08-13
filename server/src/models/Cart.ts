// src/models/Cart.ts - FIXED VERSION
import mongoose, { Document, Schema } from 'mongoose';

// ✅ FIXED: Proper interface definition matching your types
export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const cartSchema = new Schema<ICart>({
  // ✅ FIXED: Use ObjectId instead of String
  userId: {
    type: Schema.Types.ObjectId, // Changed from String to ObjectId
    ref: 'User',
    required: true,
    unique: true
  },
  
  // ✅ FIXED: Proper items array structure
  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // ✅ FIXED: Add totalAmount field to schema
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// ✅ FIXED: Properly typed pre-save middleware
cartSchema.pre<ICart>('save', function(next) {
  // Calculate total amount from items
  this.totalAmount = this.items.reduce((total: number, item: any) => {
    return total + (item.price * item.quantity);
  }, 0);
  next();
});

// ✅ FIXED: Add method to recalculate total
cartSchema.methods.calculateTotal = function(): number {
  this.totalAmount = this.items.reduce((total: number, item: any) => {
    return total + (item.price * item.quantity);
  }, 0);
  return this.totalAmount;
};

// ✅ Add useful instance methods
cartSchema.methods.addItem = function(productId: string, quantity: number, price: number) {
  const existingItemIndex = this.items.findIndex(
    (item: any) => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({ productId, quantity, price });
  }
  
  this.calculateTotal();
  return this;
};

cartSchema.methods.removeItem = function(productId: string) {
  this.items = this.items.filter(
    (item: any) => item.productId.toString() !== productId
  );
  this.calculateTotal();
  return this;
};

cartSchema.methods.updateItemQuantity = function(productId: string, quantity: number) {
  const itemIndex = this.items.findIndex(
    (item: any) => item.productId.toString() === productId
  );

  if (itemIndex > -1) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      this.items[itemIndex].quantity = quantity;
    }
    this.calculateTotal();
  }
  
  return this;
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  this.totalAmount = 0;
  return this;
};

// ✅ Indexes for performance
// cartSchema.index({ userId: 1 });
cartSchema.index({ 'items.productId': 1 });
cartSchema.index({ updatedAt: -1 });

export default mongoose.model<ICart>('Cart', cartSchema);
