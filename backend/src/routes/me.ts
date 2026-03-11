import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();

meRouter.get('/', requireAuth, (req, res) => {
  res.json({ userId: req.user!.userId, email: req.user!.email });
});
