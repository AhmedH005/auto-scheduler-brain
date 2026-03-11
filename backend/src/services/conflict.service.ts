import { prisma } from '../lib/prisma';

/**
 * Check if a proposed time range overlaps with any existing blocks for this user.
 * Returns an error message string if overlap found, or null if clear.
 */
export async function checkBlockOverlap(
  userId: string,
  start: Date,
  end: Date,
  excludeBlockId?: string,
): Promise<string | null> {
  const where: any = {
    userId,
    startTime: { lt: end },
    endTime: { gt: start },
  };

  if (excludeBlockId) {
    where.id = { not: excludeBlockId };
  }

  const conflicting = await prisma.scheduledBlock.findFirst({
    where,
    include: { task: { select: { title: true } } },
  });

  if (conflicting) {
    const blockStart = conflicting.startTime.toISOString().slice(11, 16);
    const blockEnd = conflicting.endTime.toISOString().slice(11, 16);
    const title = conflicting.task?.title || 'Unknown task';
    return `Overlaps with "${title}" (${blockStart}–${blockEnd})`;
  }

  return null;
}
