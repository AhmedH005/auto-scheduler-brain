import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function list(req: Request, res: Response) {
  const anchors = await prisma.recurringAnchorRule.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(anchors);
}

export async function getById(req: Request, res: Response) {
  const anchor = await prisma.recurringAnchorRule.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!anchor) return res.status(404).json({ error: 'Anchor rule not found' });
  res.json(anchor);
}

export async function create(req: Request, res: Response) {
  const anchor = await prisma.recurringAnchorRule.create({
    data: { ...req.body, userId: req.user!.userId },
  });
  res.status(201).json(anchor);
}

export async function update(req: Request, res: Response) {
  const existing = await prisma.recurringAnchorRule.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Anchor rule not found' });

  const anchor = await prisma.recurringAnchorRule.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(anchor);
}

export async function remove(req: Request, res: Response) {
  const existing = await prisma.recurringAnchorRule.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });
  if (!existing) return res.status(404).json({ error: 'Anchor rule not found' });

  await prisma.recurringAnchorRule.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
