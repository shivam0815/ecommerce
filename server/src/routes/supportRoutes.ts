// routes/supportRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth'; // optional

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.post('/tickets', upload.single('attachment'), async (req, res) => {
  const { name, email, phone, category, orderNumber, subject, message, source } = req.body;
  // const attachment = req.file; // if provided
  // TODO: validate + store in DB + send email/slack etc.
  const ticketId = 'TCK' + Date.now();
  return res.status(201).json({ success: true, ticketId });
});

export default router;
