import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAgenda } from '../controllers/agenda.controller';

export const agendaRouter = Router();

agendaRouter.use(requireAuth);

// GET /api/agenda?from=<ISO>&to=<ISO>
// Read-only endpoint for mobile companion app.
agendaRouter.get('/', getAgenda);
