import { describe, it, expect } from 'vitest';
import { diffSchedules, summarizeRebuild } from '@/engine/diff';
import { Task, ScheduledBlock, RebuildResult } from '@/types/task';

const task = (id: string, title: string): Task => ({
  id,
  title,
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
});

const block = (
  id: string,
  task_id: string,
  start: string,
  end: string,
  locked = false
): ScheduledBlock => ({
  id,
  task_id,
  start_time: start,
  end_time: end,
  locked,
  block_type: 'focus',
  instance_date: start.slice(0, 10),
});

describe('diffSchedules', () => {
  it('reports unchanged when both schedules are identical', () => {
    const a = block('b1', 't1', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const tasks = [task('t1', 'Task one')];
    const diff = diffSchedules([a], [a], tasks);
    expect(diff.added.length).toBe(0);
    expect(diff.moved.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.unchanged_count).toBe(1);
  });

  it('reports added when proposed has a block missing in current', () => {
    const a = block('b1', 't1', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const newBlock = block('b2', 't2', '2026-04-28T11:00:00', '2026-04-28T12:00:00');
    const tasks = [task('t1', 'A'), task('t2', 'B')];
    const diff = diffSchedules([a], [a, newBlock], tasks);
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].id).toBe('b2');
  });

  it('reports removed when current has a block missing from proposed', () => {
    const a = block('b1', 't1', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const b = block('b2', 't2', '2026-04-28T11:00:00', '2026-04-28T12:00:00');
    const tasks = [task('t1', 'A'), task('t2', 'B')];
    const diff = diffSchedules([a, b], [a], tasks);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].id).toBe('b2');
  });

  it('reports moved when same id has different times', () => {
    const before = block('b1', 't1', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const after = block('b1', 't1', '2026-04-27T14:00:00', '2026-04-27T15:00:00');
    const tasks = [task('t1', 'Task one')];
    const diff = diffSchedules([before], [after], tasks);
    expect(diff.moved.length).toBe(1);
    expect(diff.moved[0].before.start_time).toContain('09:00');
    expect(diff.moved[0].after.start_time).toContain('14:00');
    expect(diff.moved[0].task_title).toBe('Task one');
  });

  it('matches regenerated block ids by (task, date) so id changes still read as moves', () => {
    const before = block('t1-2026-04-27-540', 't1', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const after = block('t1-2026-04-27-660', 't1', '2026-04-27T11:00:00', '2026-04-27T12:00:00');
    const tasks = [task('t1', 'Task one')];
    const diff = diffSchedules([before], [after], tasks);
    expect(diff.moved.length).toBe(1);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });
});

describe('summarizeRebuild', () => {
  const result: RebuildResult = {
    blocks: [],
    dropped: [],
    at_risk: [],
    computed_at: '2026-04-27T10:00:00Z',
  };

  it('returns "No changes" when nothing differs', () => {
    const diff = { added: [], moved: [], removed: [], unchanged_count: 5, reasons: {} };
    expect(summarizeRebuild(diff, result)).toBe('No changes');
  });

  it('joins counts with separators', () => {
    const dummyBlock = block('x', 't', '2026-04-27T09:00:00', '2026-04-27T10:00:00');
    const diff = {
      added: [dummyBlock, dummyBlock],
      moved: [],
      removed: [dummyBlock],
      unchanged_count: 0,
      reasons: {},
    };
    expect(summarizeRebuild(diff, result)).toBe('2 new · 1 removed');
  });
});
