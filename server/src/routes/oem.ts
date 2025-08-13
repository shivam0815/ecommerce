import express from 'express';
import {
  createOEMInquiry,
  getOEMInquiries,
  updateOEMInquiry
} from '../controllers/oemController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Public route
router.post('/', createOEMInquiry);

// Admin routes
router.get('/', authenticate, authorize(['admin']), getOEMInquiries);
router.put('/:id', authenticate, authorize(['admin']), updateOEMInquiry);

export default router;