// routes/helpRoutes.ts
import { Router } from 'express';
import { authenticate  } from '../middleware/auth'; // optional
const router = Router();

router.get('/faqs', async (_req, res) => {
  // TODO: read from DB
  return res.json({
    faqs: [
      { q: 'How do I track my order?', a: 'Go to Profile → Orders to see status and tracking.' },
      { q: 'What is your return policy?', a: 'Returns accepted within 7 days of delivery.' },
    ],
  });
});

export default router;
