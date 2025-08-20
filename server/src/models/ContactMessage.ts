import mongoose, { Schema, Document } from 'mongoose';

export type ContactDept =
  | 'general'
  | 'support'
  | 'oem'
  | 'wholesale'
  | 'technical'
  | 'partnership';

export type ContactStatus = 'open' | 'in-progress' | 'closed';

export interface IContactMessage extends Document {
  name: string;
  email: string;
  phone?: string;
  subject: ContactDept;
  message: string;
  status: ContactStatus;
  meta?: { ip?: string; userAgent?: string };
}

const emailRx = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [emailRx, 'Please enter a valid email'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      // optional, but if present validate 10 digits
      validate: {
        validator: (v: string) => !v || /^\d{10}$/.test(v),
        message: 'Please enter a valid 10-digit phone number',
      },
    },
    subject: {
      type: String,
      required: [true, 'Department is required'],
      enum: ['general', 'support', 'oem', 'wholesale', 'technical', 'partnership'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'closed'],
      default: 'open',
    },
    meta: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        // avoid TS "delete operand must be optional"
        Reflect.deleteProperty(ret, '__v');
        return ret;
      },
    },
  }
);

export default mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);
