import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { checkBlockOverlap } from '../services/conflict.service';

export async function list(req: Request, res: Response) {
  const { from, to } = req.query;
  const where: any = { userId: req.user!.userId };
  if (from || to) {
    where.startTime = {};
    if (from) where.startTime.gte = new Date(from as string);
    if (to) where.startTime.lte = new Date(to as string);
  }

  const blocks = await prisma.scheduledBlock.findMany({ where, orderBy: { startTime: 'asc' } });
  res.json(blocks);
}

export async function create(req: Request, res: Response) {
  const data = req.body;

  const overlap = await checkBlockOverlap(
    req.user!.userId,
    new Date(data.startTime),
    new Date(data.endTime),
  );
  if (overlap) return res.status(409).json({ error: overlap });

  const block = await prisma.scheduledBlock.create({
    data: { ...data, userId: req.user!.userId },
  });
  res.status(201).json(block);
}

export async function update(req: Request, res: Response) {
  const existing = await prisma.scheduledBlock.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Block not found' });

  if (req.body.startTime || req.body.endTime) {
    const start = req.body.startTime ? new Date(req.body.startTime) : existing.startTime;
    const end = req.body.endTime ? new Date(req.body.endTime) : existing.endTime;
    const overlap = await checkBlockOverlap(req.user!.userId, start, end, req.params.id);
    if (overlap) return res.status(409).json({ error: overlap });
  }

  const block = await prisma.scheduledBlock.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(block);
}

export async function remove(req: Request, res: Response) {
  const existing = await prisma.scheduledBlock.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Block not found' });

  await prisma.scheduledBlock.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
