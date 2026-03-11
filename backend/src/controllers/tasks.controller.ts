import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { checkBlockOverlap } from '../services/conflict.service';

export async function list(req: Request, res: Response) {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
}

export async function getById(req: Request, res: Response) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}

export async function create(req: Request, res: Response) {
  const data = req.body;

  // Overlap check for fixed/anchor tasks
  if (data.schedulingMode === 'fixed' && data.startDatetime && data.endDatetime) {
    const overlap = await checkBlockOverlap(
      req.user!.userId,
      new Date(data.startDatetime),
      new Date(data.endDatetime),
    );
    if (overlap) return res.status(409).json({ error: overlap });
  }

  const task = await prisma.task.create({
    data: { ...data, userId: req.user!.userId },
  });
  res.status(201).json(task);
}

export async function update(req: Request, res: Response) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(task);
}

export async function remove(req: Request, res: Response) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
