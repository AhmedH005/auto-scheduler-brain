import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema } from '../utils/validation';
import * as ctrl from '../controllers/tasks.controller';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get('/', ctrl.list);
tasksRouter.get('/:id', ctrl.getById);
tasksRouter.post('/', validate(createTaskSchema), ctrl.create);
tasksRouter.patch('/:id', validate(updateTaskSchema), ctrl.update);
tasksRouter.delete('/:id', ctrl.remove);
