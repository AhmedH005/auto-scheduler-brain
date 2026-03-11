import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export async function get(req: Request, res: Response) {
  let settings = await prisma.userSettings.findUnique({
    where: { userId: req.user!.userId },
  });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId: req.user!.userId } });
  }
  res.json(settings);
}

export async function update(req: Request, res: Response) {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.userId },
    update: req.body,
    create: { userId: req.user!.userId, ...req.body },
  });
  res.json(settings);
}
