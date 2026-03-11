import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateSettingsSchema } from '../utils/validation';
import * as ctrl from '../controllers/settings.controller';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', ctrl.get);
settingsRouter.patch('/', validate(updateSettingsSchema), ctrl.update);
