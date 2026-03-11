import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/scheduler.controller';

export const schedulerRouter = Router();
schedulerRouter.use(requireAuth);

schedulerRouter.post('/generate', ctrl.generate);
schedulerRouter.post('/recalculate', ctrl.recalculate);
