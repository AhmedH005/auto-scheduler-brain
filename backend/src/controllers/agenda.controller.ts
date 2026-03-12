import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Maps energyIntensity to the color IDs defined in src/lib/taskColors.ts
const ENERGY_COLOR: Record<string, string> = {
  deep: 'purple',
  moderate: 'blue',
  light: 'green',
};

export async function getAgenda(req: Request, res: Response) {
  const { from, to } = req.query;

  const where: Record<string, unknown> = { userId: req.user!.userId };

  if (from || to) {
    where.startTime = {};
    const timeFilter = where.startTime as Record<string, Date>;
    if (from) timeFilter.gte = new Date(from as string);
    if (to) timeFilter.lte = new Date(to as string);
  }

  const blocks = await prisma.scheduledBlock.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: {
      task: {
        select: {
          title: true,
          schedulingMode: true,
          energyIntensity: true,
        },
      },
    },
  });

  const agenda = blocks.map((block) => ({
    id: block.id,
    title: block.task.title,
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    type: block.task.schedulingMode as 'flexible' | 'anchor' | 'fixed',
    taskId: block.taskId,
    color: ENERGY_COLOR[block.task.energyIntensity] ?? 'teal',
  }));

  res.json(agenda);
}
