import mongoose, { Schema, Document } from 'mongoose';

export type BlogStatus = 'draft' | 'published';

export interface IBlogPost extends Document {
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string;
  tags: string[];
  author?: string;
  content?: string;      // optional raw (markdown or text)
  contentHtml?: string;  // rendered HTML (recommended to store this)
  status: BlogStatus;
  publishedAt?: Date;
}

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const BlogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    excerpt: { type: String, trim: true, maxlength: 300 },
    coverImage: { type: String, trim: true },
    tags: { type: [String], default: [] },
    author: { type: String, trim: true, default: 'Nakoda Mobile' },
    content: { type: String },      // optional raw
    contentHtml: { type: String },  // HTML you render on FE
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        // make TS happy: only delete if it exists
        if (ret.__v !== undefined) delete ret.__v;
        return ret;
      },
    },
  }
);

// Auto-fill slug if missing
BlogPostSchema.pre('validate', function (next) {
  if (!this.slug && this.title) {
    this.slug = slugify(this.title);
  }
  next();
});

export default mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);
