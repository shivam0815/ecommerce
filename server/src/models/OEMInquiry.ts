import mongoose, { Schema, Document } from 'mongoose';

export interface IOEMInquiry extends Document {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  productCategory:
    | 'TWS'
    | 'Bluetooth Neckbands'
    | 'Data Cables'
    | 'Mobile Chargers'
    | 'Mobile ICs'
    | 'Mobile Repairing Tools'
    | 'Car Charger'
    | 'Bluetooth Speaker'
    | 'Power Bank'
    | 'Custom';
  quantity: number;
  customization: string;
  message?: string;
  status: 'pending' | 'contacted' | 'quoted' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
// allow optional +country and 7–15 digits
const phoneRegex = /^\+?[0-9]{7,15}$/;

const oemInquirySchema = new Schema<IOEMInquiry>(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [emailRegex, 'Please enter a valid email'],
      set: (v: string) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [phoneRegex, 'Please enter a valid phone number'],
      set: (v: string) => (typeof v === 'string' ? v.replace(/\s+/g, '').trim() : v),
    },
    productCategory: {
      type: String,
      required: [true, 'Product category is required'],
      enum: [
        'TWS',
        'Bluetooth Neckbands',
        'Data Cables',
        'Mobile Chargers',
        'Mobile ICs',
        'Mobile Repairing Tools',
        'Car Charger',
        'Bluetooth Speaker',
        'Power Bank',
        'Custom',
      ],
      // normalize FE “Custom Product” → “Custom”
      set: (v: string) => {
        const val = typeof v === 'string' ? v.trim() : v;
        return val === 'Custom Product' ? 'Custom' : val;
      },
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [100, 'Quantity must be at least 100'], // MOQ
      validate: {
        validator: (n: number) => Number.isInteger(n) && n > 0,
        message: 'Quantity must be a positive integer',
      },
    },
    customization: {
      type: String,
      required: [true, 'Customization details are required'],
      trim: true,
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      set: (v: string) => (typeof v === 'string' ? v.trim() : v),
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'quoted', 'closed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false, // drop __v
    id: false, // we’ll set our own id below
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret?._id) {
          ret.id = ret._id.toString?.() ?? ret._id;
          delete ret._id; // TS-safe because ret is any
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        if (ret?._id) {
          ret.id = ret._id.toString?.() ?? ret._id;
          delete ret._id;
        }
        return ret;
      },
    },
  }
);

/** Helpful indexes for dashboard queries */
oemInquirySchema.index({ createdAt: -1 });
oemInquirySchema.index({ status: 1, createdAt: -1 });
oemInquirySchema.index({ email: 1, createdAt: -1 });

export default mongoose.model<IOEMInquiry>('OEMInquiry', oemInquirySchema);
