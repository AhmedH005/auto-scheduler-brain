/**
 * Schedule diffing — compute what changed between current and proposed
 * blocks so the UI can show a preview before any state mutation.
 *
 * The match logic prefers id equality, but a block whose id differs only
 * because the engine regenerated it (id format `${task_id}-${date}-${slot}`)
 * still counts as a "move" if there's a same-task block on the same date
 * in both schedules. This keeps the diff readable rather than reporting
 * every regenerated block as a delete + add pair.
 */

import { Task, ScheduledBlock, ScheduleDiff, BlockMove, RebuildResult } from '@/types/task';
import { format } from 'date-fns';

const blockDate = (b: ScheduledBlock) =>
  format(new Date(b.start_time), 'yyyy-MM-dd');

const sameTime = (a: ScheduledBlock, b: ScheduledBlock) =>
  a.start_time === b.start_time && a.end_time === b.end_time;

const taskTitleByBlock = (block: ScheduledBlock, tasks: Task[]): string => {
  const t = tasks.find(t => t.id === block.task_id);
  return t?.title ?? 'Untitled';
};

export function diffSchedules(
  current: ScheduledBlock[],
  proposed: ScheduledBlock[],
  tasks: Task[]
): ScheduleDiff {
  const added: ScheduledBlock[] = [];
  const moved: BlockMove[] = [];
  const removed: ScheduledBlock[] = [];
  const reasons: Record<string, string> = {};
  let unchanged_count = 0;

  // Index current blocks by (task_id, instance_date) so regenerated ids still match
  const currentByKey = new Map<string, ScheduledBlock>();
  current.forEach(b => {
    const key = `${b.task_id}::${blockDate(b)}`;
    // If multiple blocks for same task on same day, keep them all under id-based key
    currentByKey.set(b.id, b);
    // Also keep one under task+date (first-write-wins)
    if (!currentByKey.has(key)) currentByKey.set(key, b);
  });

  const matchedCurrentIds = new Set<string>();

  for (const propBlock of proposed) {
    // First: try exact id match (preserved blocks like locked + fixed)
    const idMatch = current.find(c => c.id === propBlock.id);
    if (idMatch) {
      matchedCurrentIds.add(idMatch.id);
      if (sameTime(idMatch, propBlock)) {
        unchanged_count++;
      } else {
        moved.push({
          block_id: propBlock.id,
          task_id: propBlock.task_id,
          task_title: taskTitleByBlock(propBlock, tasks),
          before: { start_time: idMatch.start_time, end_time: idMatch.end_time },
          after: { start_time: propBlock.start_time, end_time: propBlock.end_time },
        });
      }
      continue;
    }

    // Second: try task+date match (engine regenerated id but same intent)
    const dateKey = `${propBlock.task_id}::${blockDate(propBlock)}`;
    const taskDateMatch = current.find(
      c => c.task_id === propBlock.task_id && blockDate(c) === blockDate(propBlock) && !matchedCurrentIds.has(c.id)
    );
    if (taskDateMatch) {
      matchedCurrentIds.add(taskDateMatch.id);
      if (sameTime(taskDateMatch, propBlock)) {
        unchanged_count++;
      } else {
        moved.push({
          block_id: propBlock.id,
          task_id: propBlock.task_id,
          task_title: taskTitleByBlock(propBlock, tasks),
          before: { start_time: taskDateMatch.start_time, end_time: taskDateMatch.end_time },
          after: { start_time: propBlock.start_time, end_time: propBlock.end_time },
        });
      }
      continue;
    }

    // No match in current → newly added
    added.push(propBlock);
  }

  // Anything in current not matched is removed
  for (const c of current) {
    if (!matchedCurrentIds.has(c.id)) {
      removed.push(c);
    }
  }

  return { added, moved, removed, unchanged_count, reasons };
}

/**
 * Generate plain-English reasons for the most impactful diff entries.
 * Keyed by block_id (for moves) and task_id (for drops).
 */
export function explainDiff(diff: ScheduleDiff, result: RebuildResult, tasks: Task[]): ScheduleDiff {
  const reasons: Record<string, string> = { ...diff.reasons };
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  for (const move of diff.moved) {
    const task = taskMap.get(move.task_id);
    if (!task) continue;
    const beforeDate = format(new Date(move.before.start_time), 'EEE MMM d, HH:mm');
    const afterDate = format(new Date(move.after.start_time), 'EEE MMM d, HH:mm');
    reasons[move.block_id] = `Moved from ${beforeDate} → ${afterDate}`;
  }

  for (const drop of result.dropped) {
    const explainer = (() => {
      switch (drop.reason) {
        case 'no-fit-before-deadline':
          return `Couldn't fit ${minutes(drop.remaining_minutes)} before deadline (${drop.deadline}). Add hours, lower priority, or extend the deadline.`;
        case 'over-daily-cap':
          return `Couldn't fit ${minutes(drop.remaining_minutes)} — every working day in range hit the daily cap.`;
        case 'no-working-hours-remaining':
          return `${minutes(drop.remaining_minutes)} unplaced — no working-hour slots remained in the planning window.`;
        case 'partial-placement':
          return `${minutes(drop.remaining_minutes)} unplaced — some chunks fit, the rest didn't.`;
        default:
          return `${minutes(drop.remaining_minutes)} unplaced.`;
      }
    })();
    reasons[drop.task_id] = explainer;
  }

  for (const risk of result.at_risk) {
    if (risk.reason === 'lands-on-deadline-day') {
      reasons[risk.task_id] = `Finishes on the deadline date (${risk.deadline}) — no buffer if it overruns.`;
    } else if (risk.reason === 'lands-day-before-deadline') {
      reasons[risk.task_id] = `Finishes day before deadline — limited recovery if today slips.`;
    } else if (risk.reason === 'split-spans-deadline') {
      reasons[risk.task_id] = `Last chunk lands very close to the deadline.`;
    }
  }

  return { ...diff, reasons };
}

function minutes(n: number): string {
  if (n < 60) return `${n}min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

/** Quick summary string for toasts. */
export function summarizeRebuild(diff: ScheduleDiff, result: RebuildResult): string {
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`${diff.added.length} new`);
  if (diff.moved.length > 0) parts.push(`${diff.moved.length} moved`);
  if (diff.removed.length > 0) parts.push(`${diff.removed.length} removed`);
  if (result.dropped.length > 0) parts.push(`${result.dropped.length} couldn't fit`);
  if (result.at_risk.length > 0) parts.push(`${result.at_risk.length} at risk`);
  if (parts.length === 0) return 'No changes';
  return parts.join(' · ');
}
