import mongoose, { Schema } from 'mongoose';
import { IOEMInquiry } from '../types';

const oemInquirySchema = new Schema<IOEMInquiry>({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please enter a valid phone number']
  },
  productCategory: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['TWS', 'Bluetooth Neckbands', 'Data Cables', 'Mobile Chargers', 'Mobile ICs', 'Mobile Repairing Tools', 'Custom']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  customization: {
    type: String,
    required: [true, 'Customization details are required']
  },
  message: {
    type: String,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'quoted', 'closed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

export default mongoose.model<IOEMInquiry>('OEMInquiry', oemInquirySchema);