import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createBlockSchema, updateBlockSchema } from '../utils/validation';
import * as ctrl from '../controllers/blocks.controller';

export const blocksRouter = Router();
blocksRouter.use(requireAuth);

blocksRouter.get('/', ctrl.list);
blocksRouter.post('/', validate(createBlockSchema), ctrl.create);
blocksRouter.patch('/:id', validate(updateBlockSchema), ctrl.update);
blocksRouter.delete('/:id', ctrl.remove);
