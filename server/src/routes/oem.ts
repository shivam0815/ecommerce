import express from 'express';
import {
  createOEMInquiry,
  getOEMInquiries,
  updateOEMInquiry,
} from '../controllers/oemController'; // <-- use './oemController' if that's your exact filename
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Public: Create inquiry
router.post('/', createOEMInquiry);

// Admin: List + update
router.get('/', authenticate, authorize(['admin']), getOEMInquiries);
router.put('/:id', authenticate, authorize(['admin']), updateOEMInquiry);

export default router;
