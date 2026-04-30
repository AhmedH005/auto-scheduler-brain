import {
  Task,
  ScheduledBlock,
  UserSettings,
  TaskInstance,
  DEFAULT_SETTINGS,
  RebuildResult,
  DroppedTask,
  AtRiskTask,
  DropReason,
} from '@/types/task';
import { expandRecurringTasks } from './recurring';
import { calculateScore } from './scoring';
import { addDays, format } from 'date-fns';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDateTime(date: Date): string {
  // Include timezone offset so Supabase (timestamptz) stores the correct instant.
  // Without this, PostgreSQL treats the string as UTC, shifting times for non-UTC users.
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const tzH = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzM = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${tzH}:${tzM}`;
}

interface DayState {
  deepMinutesUsed: number;
  totalMinutesUsed: number;
  consecutiveDeepBlocks: number;
  slots: { start: number; end: number }[];
}

function getInstanceKey(taskId: string, instanceDate: string): string {
  return `${taskId}::${instanceDate || 'any'}`;
}

const DEFAULT_HORIZON_DAYS = 28;

function computeRange(tasks: Task[]): { rangeStart: Date; rangeEnd: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = today;

  let latest = addDays(rangeStart, DEFAULT_HORIZON_DAYS);

  for (const task of tasks) {
    if (task.status !== 'active') continue;
    if (task.deadline) {
      const dl = parseLocalDate(task.deadline);
      if (dl > latest) latest = dl;
    }
    if (task.is_recurring && task.recurrence_end) {
      const re = parseLocalDate(task.recurrence_end);
      if (re > latest) latest = re;
    }
    // Extend range for fixed tasks with explicit datetimes
    if (task.scheduling_mode === 'fixed' && task.start_datetime) {
      const fd = new Date(task.start_datetime);
      fd.setHours(0, 0, 0, 0);
      if (fd > latest) latest = fd;
    }
  }

  return { rangeStart, rangeEnd: latest };
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Check if a proposed time range conflicts with any already-placed block on the same date. */
function hasTimeConflict(results: ScheduledBlock[], startDt: Date, endDt: Date): boolean {
  const startMs = startDt.getTime();
  const endMs = endDt.getTime();
  const dateStr = format(startDt, 'yyyy-MM-dd');
  return results.some(b => {
    if (format(new Date(b.start_time), 'yyyy-MM-dd') !== dateStr) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return bStart < endMs && bEnd > startMs;
  });
}

/**
 * Rebuild the entire schedule.
 *
 * Returns a structured result with:
 *   - blocks:   the new scheduled blocks (locked + flexible)
 *   - dropped:  tasks/instances that couldn't be fully placed, with reasons
 *   - at_risk:  tasks placed but whose finish lands close to (or past) deadline
 *   - computed_at: ISO timestamp of when the rebuild was computed
 *
 * Trust contract (verified by tests in src/test/scheduler.test.ts):
 *   1. Locked blocks (`b.locked === true`) are never moved.
 *   2. Synced external calendar events (those passed in lockedBlocks with
 *      a 'synced-' task_id prefix) are never modified.
 *   3. Fixed tasks land at exactly their start_datetime/end_datetime.
 *   4. Anchor tasks land in their preferred window (recurring → one per
 *      occurrence date).
 *   5. No block ever lands past its task's deadline.
 *   6. Daily caps (max_total + max_deep) are never exceeded.
 *   7. Working hours (working_hours_start..working_hours_end) are honored.
 */
export function rebuildSchedule(
  tasks: Task[],
  lockedBlocks: ScheduledBlock[],
  settings: UserSettings = DEFAULT_SETTINGS,
): RebuildResult {
  const { rangeStart, rangeEnd } = computeRange(tasks);

  const results: ScheduledBlock[] = [...lockedBlocks.filter(b => b.locked)];

  // Fixed tasks with explicit start/end datetimes get placed as locked blocks
  const fixedTaskIds = new Set<string>();
  for (const task of tasks) {
    if (task.status !== 'active') continue;
    if (task.scheduling_mode === 'fixed' && task.start_datetime && task.end_datetime) {
      fixedTaskIds.add(task.id);
      const alreadyLocked = results.some(b => b.task_id === task.id);
      if (!alreadyLocked) {
        const startDt = new Date(task.start_datetime);
        const endDt = new Date(task.end_datetime);
        const dateStr = format(startDt, 'yyyy-MM-dd');
        const block: ScheduledBlock = {
          id: `fixed-${task.id}`,
          task_id: task.id,
          start_time: formatLocalDateTime(startDt),
          end_time: formatLocalDateTime(endDt),
          locked: true,
          block_type: 'focus',
          instance_date: dateStr,
        };
        results.push(block);
      }
    }
  }

  // Anchor tasks get locked/protected blocks; recurring anchors get one per instance
  const anchorTaskIds = new Set<string>();
  const anchorBlocks: ScheduledBlock[] = [];
  for (const task of tasks) {
    if (task.status !== 'active') continue;
    if (task.scheduling_mode === 'anchor' && task.window_start && task.window_end) {
      anchorTaskIds.add(task.id);

      if (task.is_recurring) {
        // Generate recurring anchor blocks across the range
        const instances = expandRecurringTasks([task], rangeStart, rangeEnd);
        for (const inst of instances) {
          const dateStr = inst.instance_date;
          const alreadyExists = results.some(
            b => b.task_id === task.id && b.instance_date === dateStr
          );
          if (!alreadyExists) {
            const date = parseLocalDate(dateStr);
            const startMin = timeToMinutes(task.window_start!);
            const endMin = timeToMinutes(task.window_end!);
            date.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
            if (!hasTimeConflict(results, date, endDate)) {
              const block: ScheduledBlock = {
                id: `anchor-${task.id}-${dateStr}`,
                task_id: task.id,
                start_time: formatLocalDateTime(date),
                end_time: formatLocalDateTime(endDate),
                locked: true,
                block_type: 'focus',
                instance_date: dateStr,
              };
              anchorBlocks.push(block);
              results.push(block);
            }
          }
        }
      } else {
        // Non-recurring anchor: place once on today (or next available day without conflicts)
        const alreadyExists = results.some(b => b.task_id === task.id);
        if (!alreadyExists) {
          const startMin = timeToMinutes(task.window_start!);
          const endMin = timeToMinutes(task.window_end!);
          // Try today first, then next few days to find a conflict-free slot
          let placed = false;
          for (let dayOffset = 0; dayOffset < 14 && !placed; dayOffset++) {
            const tryDate = addDays(new Date(), dayOffset);
            const dateStr = format(tryDate, 'yyyy-MM-dd');
            const date = parseLocalDate(dateStr);
            date.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
            if (!hasTimeConflict(results, date, endDate)) {
              const block: ScheduledBlock = {
                id: `anchor-${task.id}-${dateStr}`,
                task_id: task.id,
                start_time: formatLocalDateTime(date),
                end_time: formatLocalDateTime(endDate),
                locked: true,
                block_type: 'focus',
                instance_date: dateStr,
              };
              anchorBlocks.push(block);
              results.push(block);
              placed = true;
            }
          }
        }
      }
    }
  }

  const instances = expandRecurringTasks(tasks, rangeStart, rangeEnd);
  // Filter out fixed and anchor tasks from normal scheduling
  const schedulableInstances = instances.filter(
    i => !fixedTaskIds.has(i.task.id) && !anchorTaskIds.has(i.task.id)
  );
  schedulableInstances.sort((a, b) => calculateScore(b.task) - calculateScore(a.task));

  const dayStates: Map<string, DayState> = new Map();
  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const todayStr = getTodayStr();
  const nowMinutes = getCurrentTimeMinutes();

  for (let i = 0; i < totalDays; i++) {
    const date = addDays(rangeStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');

    const workStart = timeToMinutes(settings.working_hours_start);
    const workEnd = timeToMinutes(settings.working_hours_end);

    // Clamp today's slot to current time
    let slotStart = workStart;
    if (dateStr === todayStr) {
      const rounded = Math.ceil(nowMinutes / 5) * 5;
      slotStart = Math.max(slotStart, rounded);
    }

    // Day slot safety — skip invalid slots
    if (slotStart >= workEnd) {
      dayStates.set(dateStr, {
        deepMinutesUsed: 0,
        totalMinutesUsed: 0,
        consecutiveDeepBlocks: 0,
        slots: [],
      });
    } else {
      dayStates.set(dateStr, {
        deepMinutesUsed: 0,
        totalMinutesUsed: 0,
        consecutiveDeepBlocks: 0,
        slots: [{ start: slotStart, end: workEnd }],
      });
    }
  }

  // Account for locked blocks (including fixed + anchor blocks) in dayStates
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const consumedMinutesByInstance = new Map<string, number>();

  for (const block of results) {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);
    const blockDate = format(blockStart, 'yyyy-MM-dd');
    const state = dayStates.get(blockDate);
    if (!state) continue;

    const startMin = blockStart.getHours() * 60 + blockStart.getMinutes();
    const endMin = blockEnd.getHours() * 60 + blockEnd.getMinutes();
    const duration = Math.max(endMin - startMin, 0);

    removeTimeFromSlots(state, startMin, endMin);
    state.totalMinutesUsed += duration;

    const task = taskMap.get(block.task_id);
    if (task?.energy_intensity === 'deep') state.deepMinutesUsed += duration;

    if (task) {
      const instanceDate = task.is_recurring ? (block.instance_date || blockDate) : '';
      const key = getInstanceKey(task.id, instanceDate);
      consumedMinutesByInstance.set(key, (consumedMinutesByInstance.get(key) || 0) + duration);
    }
  }

  // Track placement outcomes — populated as we schedule
  const dropped: DroppedTask[] = [];
  const placedMinutesByInstance = new Map<string, number>();
  const requiredMinutesByInstance = new Map<string, number>();

  // Schedule each instance
  const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');

  for (const instance of schedulableInstances) {
    const key = getInstanceKey(instance.task.id, instance.task.is_recurring ? instance.instance_date : '');
    const consumed = consumedMinutesByInstance.get(key) || 0;
    const remaining = Math.max(instance.remaining_duration - consumed, 0);

    requiredMinutesByInstance.set(key, instance.remaining_duration);
    placedMinutesByInstance.set(key, consumed);

    if (remaining <= 0) continue;

    const effectiveInstance: TaskInstance = {
      ...instance,
      remaining_duration: remaining,
      instance_date: instance.task.is_recurring ? instance.instance_date : '',
    };

    const placedHere = scheduleInstance(
      effectiveInstance,
      results,
      dayStates,
      settings,
      rangeStart,
      rangeEndStr
    );

    placedMinutesByInstance.set(key, consumed + placedHere);
  }

  // Compute dropped tasks: any instance where placed < required
  for (const instance of schedulableInstances) {
    const key = getInstanceKey(instance.task.id, instance.task.is_recurring ? instance.instance_date : '');
    const required = requiredMinutesByInstance.get(key) ?? 0;
    const placed = placedMinutesByInstance.get(key) ?? 0;
    if (placed < required) {
      const remaining = required - placed;
      const reason: DropReason = inferDropReason(instance.task, dayStates, remaining, settings);
      dropped.push({
        task_id: instance.task.id,
        task_title: instance.task.title,
        reason,
        remaining_minutes: remaining,
        deadline: instance.task.deadline,
        instance_date: instance.task.is_recurring ? instance.instance_date : undefined,
      });
    }
  }

  // Compute at-risk tasks: placed but finish near/past deadline
  const at_risk: AtRiskTask[] = [];
  for (const block of results) {
    if (block.locked) continue; // anchors/fixed by definition not "at risk"
    const task = taskMap.get(block.task_id);
    if (!task || !task.deadline) continue;
    const blockEnd = new Date(block.end_time);
    const deadlineEnd = parseLocalDate(task.deadline);
    deadlineEnd.setHours(23, 59, 59, 999);
    const bufferMs = deadlineEnd.getTime() - blockEnd.getTime();
    const bufferMinutes = Math.round(bufferMs / 60000);
    const blockDate = format(blockEnd, 'yyyy-MM-dd');

    if (blockDate === task.deadline) {
      // Lands ON deadline day
      // Only flag the LAST block of this task (highest end time)
      const sameTaskBlocks = results.filter(b => b.task_id === task.id);
      const lastBlock = sameTaskBlocks.reduce((latest, b) =>
        new Date(b.end_time) > new Date(latest.end_time) ? b : latest
      );
      if (lastBlock.id !== block.id) continue;
      at_risk.push({
        task_id: task.id,
        task_title: task.title,
        reason: 'lands-on-deadline-day',
        deadline: task.deadline,
        scheduled_finish: block.end_time,
        buffer_minutes: bufferMinutes,
      });
    } else if (blockDate < task.deadline) {
      // Lands day before deadline — flag if it's a one-shot task and the buffer is < 1 day's worth of work
      const dayBeforeDeadline = format(addDays(parseLocalDate(task.deadline), -1), 'yyyy-MM-dd');
      if (blockDate === dayBeforeDeadline) {
        const sameTaskBlocks = results.filter(b => b.task_id === task.id);
        const lastBlock = sameTaskBlocks.reduce((latest, b) =>
          new Date(b.end_time) > new Date(latest.end_time) ? b : latest
        );
        if (lastBlock.id !== block.id) continue;
        // Only flag if total task time > 2 hours (so a small task next-to-deadline isn't "risk")
        if (task.total_duration > 120) {
          at_risk.push({
            task_id: task.id,
            task_title: task.title,
            reason: 'lands-day-before-deadline',
            deadline: task.deadline,
            scheduled_finish: block.end_time,
            buffer_minutes: bufferMinutes,
          });
        }
      }
    }
  }

  return {
    blocks: results,
    dropped,
    at_risk,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Try to place an instance into open slots across the planning horizon.
 * Returns the number of minutes successfully placed.
 */
function scheduleInstance(
  instance: TaskInstance,
  results: ScheduledBlock[],
  dayStates: Map<string, DayState>,
  settings: UserSettings,
  rangeStart: Date,
  rangeEndStr: string
): number {
  const { task } = instance;
  let remainingDuration = instance.remaining_duration;
  let placedMinutes = 0;

  // Determine the latest allowed day for this task
  const latestAllowedDay = task.deadline || rangeEndStr;

  const daysToTry: string[] = [];
  if (task.is_recurring && instance.instance_date) {
    if (instance.instance_date <= latestAllowedDay) {
      daysToTry.push(instance.instance_date);
    }
  } else {
    // Flexible: iterate from rangeStart (today) up to latestAllowedDay
    const totalDays = Math.ceil(
      (parseLocalDate(latestAllowedDay).getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(rangeStart, i);
      const dayStr = format(day, 'yyyy-MM-dd');
      if (dayStr > latestAllowedDay) break;
      if (dayStates.has(dayStr)) {
        daysToTry.push(dayStr);
      }
    }
  }

  const chunks = getChunks(task, remainingDuration, settings);

  for (const chunk of chunks) {
    if (remainingDuration <= 0) break;
    const chunkSize = Math.min(chunk, remainingDuration);

    let scheduled = false;
    for (const dateStr of daysToTry) {
      const state = dayStates.get(dateStr);
      if (!state) continue;
      if (state.slots.length === 0) continue;

      if (state.totalMinutesUsed + chunkSize > settings.max_total_hours_per_day * 60) continue;
      if (task.energy_intensity === 'deep' && state.deepMinutesUsed + chunkSize > settings.max_deep_hours_per_day * 60) continue;

      const slot = findSlot(state, chunkSize, task, settings);
      if (slot === null) continue;

      // DEADLINE INVARIANT: block must not land after deadline
      if (task.deadline && dateStr > task.deadline) continue;

      const date = parseLocalDate(dateStr);
      date.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
      const endDate = new Date(date.getTime() + chunkSize * 60 * 1000);

      const block: ScheduledBlock = {
        id: `${task.id}-${dateStr}-${slot}`,
        task_id: task.id,
        start_time: formatLocalDateTime(date),
        end_time: formatLocalDateTime(endDate),
        locked: false,
        block_type: 'focus',
        instance_date: dateStr,
      };

      results.push(block);
      removeTimeFromSlots(state, slot, slot + chunkSize);
      if (settings.buffer_time > 0) {
        removeTimeFromSlots(state, slot + chunkSize, slot + chunkSize + settings.buffer_time);
      }

      state.totalMinutesUsed += chunkSize;
      if (task.energy_intensity === 'deep') {
        state.deepMinutesUsed += chunkSize;
        state.consecutiveDeepBlocks++;
      } else {
        state.consecutiveDeepBlocks = 0;
      }

      remainingDuration -= chunkSize;
      placedMinutes += chunkSize;
      scheduled = true;
      break;
    }

    if (!scheduled) break;
  }

  return placedMinutes;
}

/** Best guess at why a task instance got dropped. */
function inferDropReason(
  task: Task,
  dayStates: Map<string, DayState>,
  remainingMinutes: number,
  settings: UserSettings
): DropReason {
  // Did we run out of working hours before deadline?
  if (task.deadline) {
    const deadline = parseLocalDate(task.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const maxAvailableMinutes = daysUntil * settings.max_total_hours_per_day * 60;
    if (remainingMinutes > maxAvailableMinutes) {
      return 'no-fit-before-deadline';
    }
  }

  // Were daily caps the binding constraint?
  let allDaysFull = true;
  for (const state of dayStates.values()) {
    if (state.totalMinutesUsed < settings.max_total_hours_per_day * 60 && state.slots.length > 0) {
      allDaysFull = false;
      break;
    }
  }
  if (allDaysFull) return 'over-daily-cap';

  // Partial placement (some chunks fit but not all)
  return 'partial-placement';
}

function findSlot(
  state: DayState,
  duration: number,
  task: Task,
  settings: UserSettings
): number | null {
  const deepStart = timeToMinutes(settings.deep_window_start);
  const deepEnd = timeToMinutes(settings.deep_window_end);

  // Anchor tasks no longer use findSlot (handled separately), but keep window logic for legacy
  let windowStart = 0;
  let windowEnd = 24 * 60;

  const preferDeepWindow = task.energy_intensity === 'deep';

  const sortedSlots = [...state.slots].sort((a, b) => {
    if (preferDeepWindow) {
      const aInDeep = a.start >= deepStart && a.end <= deepEnd;
      const bInDeep = b.start >= deepStart && b.end <= deepEnd;
      if (aInDeep && !bInDeep) return -1;
      if (!aInDeep && bInDeep) return 1;
    }
    return a.start - b.start;
  });

  for (const slot of sortedSlots) {
    const effectiveStart = Math.max(slot.start, windowStart);
    const effectiveEnd = Math.min(slot.end, windowEnd);

    if (effectiveStart >= effectiveEnd) continue;

    if (effectiveEnd - effectiveStart >= duration) {
      if (task.energy_intensity === 'deep' && state.consecutiveDeepBlocks >= 2) continue;
      return effectiveStart;
    }
  }

  return null;
}

function getChunks(task: Task, totalDuration: number, settings: UserSettings): number[] {
  switch (task.execution_style) {
    case 'single':
      return [totalDuration];
    case 'split':
      return splitIntoChunks(totalDuration, settings.min_chunk_size, settings.max_chunk_size);
    case 'auto_chunk': {
      const optimalSize = task.energy_intensity === 'deep' ? 50 : task.energy_intensity === 'moderate' ? 45 : 30;
      const minSize = Math.min(optimalSize, settings.min_chunk_size);
      return splitIntoChunks(totalDuration, minSize, optimalSize);
    }
    default:
      return [totalDuration];
  }
}

function splitIntoChunks(total: number, minSize: number, maxSize: number): number[] {
  const chunks: number[] = [];
  let remaining = total;

  while (remaining > 0) {
    const chunk = Math.min(maxSize, remaining);
    if (chunk < minSize && chunks.length > 0) {
      chunks[chunks.length - 1] += chunk;
      remaining = 0;
    } else {
      chunks.push(chunk);
      remaining -= chunk;
    }
  }

  return chunks;
}

function removeTimeFromSlots(state: DayState, start: number, end: number): void {
  const newSlots: { start: number; end: number }[] = [];
  for (const slot of state.slots) {
    if (slot.end <= start || slot.start >= end) {
      newSlots.push(slot);
    } else {
      if (slot.start < start) newSlots.push({ start: slot.start, end: start });
      if (slot.end > end) newSlots.push({ start: end, end: slot.end });
    }
  }
  state.slots = newSlots.filter(s => s.end > s.start);
}
