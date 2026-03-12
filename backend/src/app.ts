import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { tasksRouter } from './routes/tasks';
import { blocksRouter } from './routes/blocks';
import { anchorsRouter } from './routes/anchors';
import { settingsRouter } from './routes/settings';
import { schedulerRouter } from './routes/scheduler';
import { meRouter } from './routes/me';
import { agendaRouter } from './routes/agenda';

export const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/tasks', tasksRouter);
app.use('/blocks', blocksRouter);
app.use('/anchors', anchorsRouter);
app.use('/settings', settingsRouter);
app.use('/scheduler', schedulerRouter);
app.use('/api/agenda', agendaRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});
