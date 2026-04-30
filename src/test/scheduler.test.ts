import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { rebuildSchedule } from '@/engine/scheduler';
import { Task, ScheduledBlock, DEFAULT_SETTINGS, UserSettings } from '@/types/task';
import { format, addDays } from 'date-fns';

// Engine v2 returns a RebuildResult; the placement tests below pre-date
// that change and care only about the blocks list. Unwrap for them.
const runBlocks = (
  tasks: Task[],
  locked: ScheduledBlock[] = [],
  settings: UserSettings = DEFAULT_SETTINGS
) => rebuildSchedule(tasks, locked, settings).blocks;

// Lock "today" to a Monday so weekday recurrences are deterministic.
// 2026-04-27 is a Monday. All relative dates derive from this.
const TODAY = new Date('2026-04-27T08:00:00Z').getTime();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    title: 'Task',
    total_duration: 60,
    priority: 3,
    deadline: null,
    energy_intensity: 'moderate',
    scheduling_mode: 'flexible',
    window_start: null,
    window_end: null,
    start_datetime: null,
    end_datetime: null,
    execution_style: 'single',
    is_recurring: false,
    recurrence_pattern: null,
    recurrence_interval: 1,
    recurrence_end: null,
    status: 'active',
    created_at: '2026-04-20T00:00:00Z',
    ...overrides,
  };
}

const offsetDate = (days: number) =>
  format(addDays(new Date(TODAY), days), 'yyyy-MM-dd');

const blockHour = (block: ScheduledBlock) =>
  new Date(block.start_time).getHours();

const blockDate = (block: ScheduledBlock) =>
  format(new Date(block.start_time), 'yyyy-MM-dd');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('rebuildSchedule — placement', () => {
  it('places a flexible deep task in the deep-work window (08:00–12:00)', () => {
    const task = makeTask({
      title: 'Thesis',
      energy_intensity: 'deep',
      total_duration: 90,
      deadline: offsetDate(3),
    });
    const blocks = runBlocks([task]);
    const placed = blocks.find(b => b.task_id === task.id);
    expect(placed).toBeDefined();
    const hour = blockHour(placed!);
    expect(hour).toBeGreaterThanOrEqual(8);
    expect(hour).toBeLessThan(12);
  });

  it('places a fixed task at its exact start datetime, locked', () => {
    const task = makeTask({
      title: 'Dentist',
      scheduling_mode: 'fixed',
      start_datetime: `${offsetDate(2)}T14:00:00`,
      end_datetime: `${offsetDate(2)}T14:45:00`,
      total_duration: 45,
    });
    const blocks = runBlocks([task]);
    const placed = blocks.find(b => b.task_id === task.id);
    expect(placed).toBeDefined();
    expect(placed!.locked).toBe(true);
    expect(blockHour(placed!)).toBe(14);
    expect(blockDate(placed!)).toBe(offsetDate(2));
  });

  it('locks recurring anchor blocks at their preferred window every weekday', () => {
    const task = makeTask({
      title: 'Gym',
      scheduling_mode: 'anchor',
      window_start: '07:00',
      window_end: '08:00',
      total_duration: 60,
      is_recurring: true,
      recurrence_pattern: 'weekdays',
      recurrence_end: offsetDate(14),
    });
    const blocks = runBlocks([task]);
    const anchorBlocks = blocks.filter(b => b.task_id === task.id);
    expect(anchorBlocks.length).toBeGreaterThanOrEqual(5); // at least one work week
    anchorBlocks.forEach(b => {
      expect(b.locked).toBe(true);
      expect(blockHour(b)).toBe(7);
    });
  });
});

describe('rebuildSchedule — invariants (trust contract)', () => {
  it('NEVER schedules a block past its deadline', () => {
    const task = makeTask({
      title: 'Urgent',
      total_duration: 60,
      deadline: offsetDate(1), // due tomorrow
      priority: 5,
    });
    const blocks = runBlocks([task]);
    const placed = blocks.filter(b => b.task_id === task.id);
    placed.forEach(b => {
      expect(blockDate(b) <= offsetDate(1)).toBe(true);
    });
  });

  it('preserves user-locked blocks across rebuild — they are not moved', () => {
    const task = makeTask({ title: 'Locked work', total_duration: 60 });
    const lockedBlock: ScheduledBlock = {
      id: 'manual-lock-1',
      task_id: task.id,
      start_time: `${offsetDate(0)}T15:00:00`,
      end_time: `${offsetDate(0)}T16:00:00`,
      locked: true,
      block_type: 'focus',
      instance_date: offsetDate(0),
    };
    const blocks = runBlocks([task], [lockedBlock]);
    const survivor = blocks.find(b => b.id === 'manual-lock-1');
    expect(survivor).toBeDefined();
    expect(survivor!.start_time).toContain('15:00:00');
    expect(survivor!.locked).toBe(true);
  });

  it('respects daily total-hours cap (max_total_hours_per_day)', () => {
    const settings: UserSettings = { ...DEFAULT_SETTINGS, max_total_hours_per_day: 4 };
    // 8 tasks of 60 min each, all due tomorrow — engine should cap at 4h/day
    const tasks = Array.from({ length: 8 }, (_, i) =>
      makeTask({ id: `t-${i}`, title: `Work ${i}`, total_duration: 60, deadline: offsetDate(2) })
    );
    const blocks = runBlocks(tasks, [], settings);
    // Group by date
    const byDate = new Map<string, number>();
    blocks.forEach(b => {
      const date = blockDate(b);
      const dur = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000;
      byDate.set(date, (byDate.get(date) ?? 0) + dur);
    });
    byDate.forEach(minutes => {
      expect(minutes).toBeLessThanOrEqual(4 * 60); // 4h cap
    });
  });

  it('respects daily deep-work cap (max_deep_hours_per_day)', () => {
    const settings: UserSettings = { ...DEFAULT_SETTINGS, max_deep_hours_per_day: 2 };
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({
        id: `deep-${i}`,
        title: `Deep ${i}`,
        total_duration: 60,
        energy_intensity: 'deep',
        deadline: offsetDate(2),
      })
    );
    const blocks = runBlocks(tasks, [], settings);
    const byDate = new Map<string, number>();
    blocks.forEach(b => {
      const date = blockDate(b);
      const dur = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000;
      byDate.set(date, (byDate.get(date) ?? 0) + dur);
    });
    byDate.forEach(minutes => {
      expect(minutes).toBeLessThanOrEqual(2 * 60); // 2h deep cap (all are deep)
    });
  });

  it('respects working hours (no blocks before 08:00 or at/after 18:00)', () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeTask({ id: `w-${i}`, title: `Work ${i}`, total_duration: 60 })
    );
    const blocks = runBlocks(tasks).filter(b => !b.locked);
    blocks.forEach(b => {
      const startH = blockHour(b);
      const endH = new Date(b.end_time).getHours();
      expect(startH).toBeGreaterThanOrEqual(8);
      expect(endH).toBeLessThanOrEqual(18);
    });
  });

  it('inserts buffer time between consecutive blocks', () => {
    const settings: UserSettings = { ...DEFAULT_SETTINGS, buffer_time: 15 };
    const tasks = [
      makeTask({ id: 'a', title: 'A', total_duration: 60, deadline: offsetDate(2) }),
      makeTask({ id: 'b', title: 'B', total_duration: 60, deadline: offsetDate(2) }),
      makeTask({ id: 'c', title: 'C', total_duration: 60, deadline: offsetDate(2) }),
    ];
    const blocks = runBlocks(tasks, [], settings)
      .filter(b => !b.locked)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    for (let i = 0; i < blocks.length - 1; i++) {
      const sameDay = blockDate(blocks[i]) === blockDate(blocks[i + 1]);
      if (!sameDay) continue;
      const gap = (new Date(blocks[i + 1].start_time).getTime() - new Date(blocks[i].end_time).getTime()) / 60000;
      expect(gap).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('rebuildSchedule — over-commit behavior', () => {
  it('drops tasks silently when over-committed (KNOWN GAP — should warn user)', () => {
    // 12 tasks × 60min = 12h of work, all due tomorrow, 4h daily cap = 8h available before deadline
    const settings: UserSettings = { ...DEFAULT_SETTINGS, max_total_hours_per_day: 4 };
    const tasks = Array.from({ length: 12 }, (_, i) =>
      makeTask({
        id: `over-${i}`,
        title: `Overflow ${i}`,
        total_duration: 60,
        deadline: offsetDate(1),
        priority: 3,
      })
    );
    const blocks = runBlocks(tasks, [], settings).filter(b => !b.locked);
    const placedTaskIds = new Set(blocks.map(b => b.task_id));
    // We placed AT MOST what fits in remaining time. Some tasks WILL be dropped.
    expect(placedTaskIds.size).toBeLessThan(tasks.length);
    // The engine returns no signal that tasks were dropped — only the count gap reveals it.
    // This test documents the behavior; making it explicit (return value or callback) is a
    // recommended future improvement.
  });
});

describe('rebuildSchedule — recurring expansion', () => {
  it('weekdays-only recurrence skips Saturdays and Sundays', () => {
    const task = makeTask({
      id: 'inbox',
      title: 'Inbox',
      total_duration: 30,
      energy_intensity: 'light',
      is_recurring: true,
      recurrence_pattern: 'weekdays',
      recurrence_end: offsetDate(13), // 2 weeks
    });
    const blocks = runBlocks([task]);
    const placed = blocks.filter(b => b.task_id === task.id);
    placed.forEach(b => {
      const day = new Date(b.start_time).getDay(); // 0=Sun, 6=Sat
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    });
  });
});

describe('rebuildSchedule — completion preservation + partial roll-forward', () => {
  it('preserves completed blocks across rebuild (treats them like locks)', () => {
    const task = makeTask({ id: 'done-task', title: 'Done already', total_duration: 60 });
    const completedBlock: ScheduledBlock = {
      id: 'completed-1',
      task_id: task.id,
      start_time: `${offsetDate(0)}T09:00:00`,
      end_time: `${offsetDate(0)}T10:00:00`,
      locked: false,
      block_type: 'focus',
      instance_date: offsetDate(0),
      completed_at: new Date(TODAY).toISOString(),
      actual_minutes: 60,
    };
    const result = rebuildSchedule([task], [completedBlock], DEFAULT_SETTINGS);
    const survivor = result.blocks.find(b => b.id === 'completed-1');
    expect(survivor).toBeDefined();
    expect(survivor!.completed_at).toBeDefined();
  });

  it('rolls partial completions forward — 30min done on a 60min block places another 30min', () => {
    const task = makeTask({ id: 'partial', title: 'Partial work', total_duration: 60 });
    const partialBlock: ScheduledBlock = {
      id: 'partial-1',
      task_id: task.id,
      start_time: `${offsetDate(0)}T09:00:00`,
      end_time: `${offsetDate(0)}T10:00:00`,
      locked: false,
      block_type: 'focus',
      instance_date: offsetDate(0),
      completed_at: new Date(TODAY).toISOString(),
      actual_minutes: 30,
    };
    const result = rebuildSchedule([task], [partialBlock], DEFAULT_SETTINGS);
    const taskBlocks = result.blocks.filter(b => b.task_id === task.id);
    // Original (preserved) + a new placement of the remaining 30min
    expect(taskBlocks.length).toBeGreaterThanOrEqual(2);
    const newBlock = taskBlocks.find(b => b.id !== 'partial-1');
    expect(newBlock).toBeDefined();
    const newDur =
      (new Date(newBlock!.end_time).getTime() - new Date(newBlock!.start_time).getTime()) / 60000;
    expect(newDur).toBe(30);
  });

  it('honors per-day cap overrides (easy day = lower cap)', () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      makeTask({ id: `t-${i}`, title: `Task ${i}`, total_duration: 60, deadline: offsetDate(0) })
    );
    const overrides = { [offsetDate(0)]: { max_total_hours: 2, max_deep_hours: 1, label: 'easy' as const } };
    const result = rebuildSchedule(tasks, [], DEFAULT_SETTINGS, overrides);
    const todayMinutes = result.blocks
      .filter(b => !b.locked && blockDate(b) === offsetDate(0))
      .reduce((acc, b) => acc + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000, 0);
    expect(todayMinutes).toBeLessThanOrEqual(2 * 60); // 2h cap, not the 8h default
  });
});

describe('rebuildSchedule — score-driven priority', () => {
  it('higher-priority task wins the better slot when slots are scarce', () => {
    const settings: UserSettings = {
      ...DEFAULT_SETTINGS,
      working_hours_start: '09:00',
      working_hours_end: '11:00', // only 2 hours of working time
    };
    const lowPri = makeTask({
      id: 'low',
      title: 'Low priority',
      total_duration: 60,
      priority: 1,
      deadline: offsetDate(7),
    });
    const highPri = makeTask({
      id: 'high',
      title: 'High priority urgent',
      total_duration: 60,
      priority: 5,
      deadline: offsetDate(1),
    });
    const blocks = runBlocks([lowPri, highPri], [], settings).filter(b => !b.locked);
    const today = offsetDate(0);
    const todayBlocks = blocks.filter(b => blockDate(b) === today);
    // High-priority urgent task should land today
    expect(todayBlocks.find(b => b.task_id === 'high')).toBeDefined();
  });
});
