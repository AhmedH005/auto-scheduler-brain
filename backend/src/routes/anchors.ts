import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createAnchorSchema, updateAnchorSchema } from '../utils/validation';
import * as ctrl from '../controllers/anchors.controller';

export const anchorsRouter = Router();
anchorsRouter.use(requireAuth);

anchorsRouter.get('/', ctrl.list);
anchorsRouter.get('/:id', ctrl.getById);
anchorsRouter.post('/', validate(createAnchorSchema), ctrl.create);
anchorsRouter.patch('/:id', validate(updateAnchorSchema), ctrl.update);
anchorsRouter.delete('/:id', ctrl.remove);
