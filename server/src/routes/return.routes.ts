// routes/return.routes.ts
import { Router } from 'express';
import multer from 'multer';
import {
  createReturnRequest,
  listMyReturns,
  getMyReturn,
  cancelMyReturn,
  adminListReturns,
  adminGetReturn,
  adminDecision,
  adminMarkReceived,
  adminRefund,
} from '../controllers/return.controller';
import { authenticate, authorize } from '../middleware/auth';

const upload = multer({ dest: 'tmp/' });
const router = Router();

// USER
router.get('/returns', authenticate, listMyReturns);
router.get('/returns/:id', authenticate, getMyReturn);
router.post('/returns', authenticate, upload.array('images', 6), createReturnRequest);
router.patch('/returns/:id/cancel', authenticate, cancelMyReturn);

// ADMIN
router.get('/admin/returns', authenticate, authorize(['admin']), adminListReturns);
router.get('/admin/returns/:id', authenticate, authorize(['admin']), adminGetReturn);
router.patch('/admin/returns/:id/decision', authenticate, authorize(['admin']), adminDecision);
router.patch('/admin/returns/:id/mark-received', authenticate, authorize(['admin']), adminMarkReceived);
router.patch('/admin/returns/:id/refund', authenticate, authorize(['admin']), adminRefund);

export default router;
