import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * POST /scheduler/generate
 * 
 * Generates a fresh schedule for the user.
 * 
 * TODO: Port the frontend scheduling engine (src/engine/scheduler.ts)
 * to this server-side service. The algorithm should:
 * 1. Load all active tasks + settings for the user
 * 2. Preserve locked blocks
 * 3. Place fixed tasks at exact datetimes
 * 4. Place anchor tasks as protected recurring blocks
 * 5. Schedule flexible tasks using scoring + chunking
 * 6. Return the generated blocks
 */
export async function generate(req: Request, res: Response) {
  const userId = req.user!.userId;

  const [tasks, lockedBlocks, settings] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: 'active' } }),
    prisma.scheduledBlock.findMany({ where: { userId, locked: true } }),
    prisma.userSettings.findUnique({ where: { userId } }),
  ]);

  // TODO: Implement server-side scheduling engine
  // For now, return current locked blocks as placeholder
  res.json({
    message: 'Scheduler engine not yet ported. See TODO in scheduler.controller.ts',
    tasks: tasks.length,
    lockedBlocks: lockedBlocks.length,
    blocks: lockedBlocks,
  });
}

/**
 * POST /scheduler/recalculate
 * 
 * Recalculates schedule preserving locked/manual blocks.
 * Same as generate but explicitly preserves user-locked blocks.
 */
export async function recalculate(req: Request, res: Response) {
  // Same flow as generate — the engine should respect locked blocks
  return generate(req, res);
}
