import express from 'express';
import {
  listPublicPosts,
  getPublicPost,
  createPost,
  updatePost,
  deletePost,
} from '../controllers/blogController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Public
router.get('/', listPublicPosts);
router.get('/:slug', getPublicPost);

// Admin
router.post('/', authenticate, authorize(['admin']), createPost);
router.put('/:id', authenticate, authorize(['admin']), updatePost);
router.delete('/:id', authenticate, authorize(['admin']), deletePost);

export default router;
