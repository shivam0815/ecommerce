import mongoose, { Schema, Document } from 'mongoose';

export interface ISupportConfig extends Document {
  channels: {
    email: boolean;
    phone: boolean;
    whatsapp: boolean;
    chat: boolean;
  };
  email: {
    address: string;
    responseTimeHours: number;
  };
  phone: {
    number: string;
    hours: string;
  };
  whatsapp: {
    number: string;
    link: string;
  };
  faq: {
    enabled: boolean;
    url?: string;
  };
  updatedAt: Date;
}

const SupportConfigSchema = new Schema<ISupportConfig>(
  {
    channels: {
      email: { type: Boolean, default: true },
      phone: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
      chat: { type: Boolean, default: false },
    },
    email: {
      address: { type: String, default: process.env.SUPPORT_EMAIL || 'support@example.com' },
      responseTimeHours: { type: Number, default: Number(process.env.SUPPORT_RESP_HOURS || 24) },
    },
    phone: {
      number: { type: String, default: process.env.SUPPORT_PHONE || '+91-99999-99999' },
      hours: { type: String, default: process.env.SUPPORT_HOURS || 'Mon–Sat 10:00–19:00 IST' },
    },
    whatsapp: {
      number: { type: String, default: process.env.SUPPORT_WHATSAPP || '+91-99999-99999' },
      link: {
        type: String,
        default:
          process.env.SUPPORT_WHATSAPP_LINK ||
          'https://wa.me/919999999999?text=Hi%20Support',
      },
    },
    faq: {
      enabled: { type: Boolean, default: true },
      url: { type: String, default: process.env.SUPPORT_FAQ_URL || '' },
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<ISupportConfig>('SupportConfig', SupportConfigSchema);
