import { Request, Response } from 'express';
import BlogPost from '../models/BlogPost';

export const listPublicPosts = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const q = (req.query.q as string)?.trim();
    const tag = (req.query.tag as string)?.trim();

    const filter: any = { status: 'published' };
    if (tag) filter.tags = tag;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } },
        { tags: { $regex: q, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title slug excerpt coverImage tags author publishedAt createdAt')
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

export const getPublicPost = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const post = await BlogPost.findOne({ slug, status: 'published' }).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

// Admin: create / update / delete
export const createPost = async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.create(req.body);
    res.status(201).json({ success: true, post });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Invalid payload' });
  }
};

export const updatePost = async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, post });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Invalid payload' });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
