import mongoose, { Schema, Document, Types } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high';

export interface ITicketAttachment {
  url: string;
  name?: string;
  size?: number;
  mime?: string;
}

export interface ISupportTicket extends Document {
  subject: string;
  category?: string;
  message: string;
  email: string;
  phone?: string;
  orderId?: string;
  userId?: Types.ObjectId;
  status: TicketStatus;
  priority: TicketPriority;
  channel: 'web' | 'email' | 'whatsapp';
  attachments: ITicketAttachment[];
}

const TicketAttachmentSchema = new Schema<ITicketAttachment>({
  url: { type: String, required: true },
  name: String,
  size: Number,
  mime: String,
});

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    subject: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    orderId: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    channel: { type: String, enum: ['web', 'email', 'whatsapp'], default: 'web' },
    attachments: { type: [TicketAttachmentSchema], default: [] },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ email: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
