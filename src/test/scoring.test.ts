import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateScore, sortByScore, URGENCY_WEIGHT, IMPORTANCE_WEIGHT, ENERGY_WEIGHT } from '@/engine/scoring';
import { Task } from '@/types/task';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'test',
    title: 'Test task',
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
    created_at: '2026-01-01T00:00:00',
    ...overrides,
  };
}

// Fix "today" to 2026-03-11T00:00:00Z for deterministic deadline tests
const TODAY = new Date('2026-03-11T00:00:00Z').getTime();

afterEach(() => {
  vi.restoreAllMocks();
});

function pinDate() {
  vi.spyOn(Date, 'now').mockReturnValue(TODAY);
}

describe('weight constants', () => {
  it('exports the specified weights', () => {
    expect(URGENCY_WEIGHT).toBe(3);
    expect(IMPORTANCE_WEIGHT).toBe(2);
    expect(ENERGY_WEIGHT).toBe(1.5);
  });
});

describe('urgency component', () => {
  it('tasks with no deadline get a 0.1 baseline urgency', () => {
    pinDate();
    const task = makeTask({ priority: 5, deadline: null });
    const score = calculateScore(task);
    // energy=0 (no slotHour), importance=(5-1)/4=1
    // expected = 0.1*3 + 1*2 = 0.3 + 2 = 2.3
    expect(score).toBeCloseTo(0.1 * URGENCY_WEIGHT + 1 * IMPORTANCE_WEIGHT);
  });

  it('overdue tasks get urgency=1', () => {
    pinDate();
    const task = makeTask({ priority: 1, deadline: '2026-03-10' }); // yesterday
    const score = calculateScore(task);
    // importance = (1-1)/4 = 0
    expect(score).toBeCloseTo(1 * URGENCY_WEIGHT + 0 * IMPORTANCE_WEIGHT);
  });

  it('due today gets urgency=1', () => {
    pinDate();
    const task = makeTask({ priority: 1, deadline: '2026-03-11' });
    // daysUntil ~ 0 → urgency=1
    const score = calculateScore(task);
    expect(score).toBeCloseTo(1 * URGENCY_WEIGHT, 0);
  });

  it('farther deadlines reduce urgency', () => {
    pinDate();
    const near = makeTask({ priority: 3, deadline: '2026-03-12' }); // 1 day
    const far  = makeTask({ priority: 3, deadline: '2026-03-21' }); // 10 days
    expect(calculateScore(near)).toBeGreaterThan(calculateScore(far));
  });
});

describe('importance component', () => {
  it('P5 scores higher importance than P1', () => {
    pinDate();
    const p5 = makeTask({ priority: 5, deadline: null });
    const p1 = makeTask({ priority: 1, deadline: null });
    expect(calculateScore(p5)).toBeGreaterThan(calculateScore(p1));
  });

  it('P1 with imminent deadline outscores P5 with no deadline', () => {
    pinDate();
    const p1urgent = makeTask({ priority: 1, deadline: '2026-03-11' }); // today
    const p5lazy   = makeTask({ priority: 5, deadline: null });
    expect(calculateScore(p1urgent)).toBeGreaterThan(calculateScore(p5lazy));
  });
});

describe('energy matching', () => {
  it('deep task scores highest in the morning (hour 9)', () => {
    const task = makeTask({ energy_intensity: 'deep' });
    const morning   = calculateScore(task, 9);   // deep slot   → match=1
    const afternoon = calculateScore(task, 14);  // moderate slot → adjacent=0.5
    const evening   = calculateScore(task, 19);  // light slot  → mismatch=0
    expect(morning).toBeGreaterThan(afternoon);
    expect(afternoon).toBeGreaterThan(evening);
  });

  it('moderate task scores highest in the afternoon (hour 14)', () => {
    const task = makeTask({ energy_intensity: 'moderate' });
    const morning   = calculateScore(task, 9);
    const afternoon = calculateScore(task, 14);
    const evening   = calculateScore(task, 19);
    expect(afternoon).toBeGreaterThan(morning);
    expect(afternoon).toBeGreaterThan(evening);
  });

  it('light task scores highest in the evening (hour 19)', () => {
    const task = makeTask({ energy_intensity: 'light' });
    const morning = calculateScore(task, 9);
    const evening = calculateScore(task, 19);
    expect(evening).toBeGreaterThan(morning);
  });

  it('without slotHour the energy term is excluded (=0)', () => {
    const task = makeTask({ energy_intensity: 'deep' });
    const withSlot    = calculateScore(task, 9);
    const withoutSlot = calculateScore(task);
    expect(withSlot).toBeGreaterThan(withoutSlot);
  });
});

describe('sortByScore', () => {
  it('returns tasks sorted descending by score', () => {
    pinDate();
    const tasks = [
      makeTask({ id: 'low',  priority: 1, deadline: null }),
      makeTask({ id: 'high', priority: 5, deadline: '2026-03-11' }),
      makeTask({ id: 'mid',  priority: 3, deadline: '2026-03-20' }),
    ];
    const sorted = sortByScore(tasks);
    expect(sorted[0].id).toBe('high');
    expect(sorted[sorted.length - 1].id).toBe('low');
  });

  it('does not mutate the original array', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const original = [...tasks];
    sortByScore(tasks);
    expect(tasks).toEqual(original);
  });
});
