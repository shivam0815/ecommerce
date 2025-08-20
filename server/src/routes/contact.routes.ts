import express from 'express';
import {
  createContactMessage,
  getContactMessages,
  updateContactMessage,
} from '../controllers/contactController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Public create
router.post('/', createContactMessage);

// Admin list/update
router.get('/', authenticate, authorize(['admin']), getContactMessages);
router.put('/:id', authenticate, authorize(['admin']), updateContactMessage);

export default router;
