import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];
  rating: number;
  reviews: number;
  inStock: boolean;
  stockQuantity: number;
  features: string[];
  specifications: Map<string, any>;
  tags: string[];
  isActive: boolean;
  status: 'active' | 'inactive' | 'draft';
  businessName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['TWS', 'Bluetooth Neckbands', 'Data Cables', 'Mobile Chargers', 'Mobile ICs', 'Mobile Repairing Tools', 'Electronics', 'Accessories','Car Charger', 'Bleutooth Speaker','Power Bank','Other'],
      message: '{VALUE} is not a valid category'
    }
  },
  subcategory: String,
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    default: 'Nakoda'
  },
  images: [{
    type: String,
    required: false
  }],
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5']
  },
  reviews: {
    type: Number,
    default: 0
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    default: 0
  },
  features: [String],
  specifications: {
    type: Map,
    of: String,
    default: {}
  },
  tags: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  businessName: String
}, {
  timestamps: true
});

productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ isActive: 1, inStock: 1, status: 1 });
productSchema.index({ createdAt: -1 });











productSchema.pre('save', function(next) {
  this.inStock = this.stockQuantity > 0;
  next();
});

export default mongoose.model<IProduct>('Product', productSchema);
