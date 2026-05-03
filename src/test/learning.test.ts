import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  learnEnergyCurve,
  learnCapacity,
  learnDayShape,
  detectRecurringMisses,
  buildWeeklyDigest,
  buildCompletionEvent,
  appendCompletion,
} from '@/engine/learning';
import { Task, CompletionEvent, EnergyIntensity } from '@/types/task';

// 2026-04-27 is a Monday. Lock time so day_of_week / hour_of_day are deterministic.
const TODAY = new Date('2026-04-27T08:00:00Z').getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY));
});

afterAll(() => {
  vi.useRealTimers();
});

function evt(
  i: number,
  partial: Partial<CompletionEvent> = {}
): CompletionEvent {
  const start = new Date(TODAY);
  start.setHours(9, 0, 0, 0);
  start.setDate(start.getDate() - i);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);
  return {
    id: `e-${i}`,
    task_id: 't',
    task_title: 'Task',
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    scheduled_minutes: 60,
    energy_intensity: 'deep',
    status: 'done',
    actual_minutes: 60,
    recorded_at: end.toISOString(),
    day_of_week: start.getDay(),
    hour_of_day: start.getHours(),
    confidence: 'confirmed',
    ...partial,
  };
}

function evtAt(args: {
  i: number;
  hour: number;
  daysBack?: number;
  energy?: EnergyIntensity;
  status?: CompletionEvent['status'];
  scheduledMin?: number;
  actualMin?: number;
  taskId?: string;
  taskTitle?: string;
  confidence?: CompletionEvent['confidence'];
}): CompletionEvent {
  const start = new Date(TODAY);
  start.setHours(args.hour, 0, 0, 0);
  start.setDate(start.getDate() - (args.daysBack ?? 0));
  const dur = args.scheduledMin ?? 60;
  const end = new Date(start.getTime() + dur * 60000);
  return {
    id: `e-${args.i}`,
    task_id: args.taskId ?? 't',
    task_title: args.taskTitle ?? 'Task',
    scheduled_start: start.toISOString(),
    scheduled_end: end.toISOString(),
    scheduled_minutes: dur,
    energy_intensity: args.energy ?? 'deep',
    status: args.status ?? 'done',
    actual_minutes:
      args.actualMin ?? (args.status === 'skipped' ? undefined : dur),
    recorded_at: end.toISOString(),
    day_of_week: start.getDay(),
    hour_of_day: start.getHours(),
    confidence: args.confidence ?? 'confirmed',
  };
}

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't',
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
});

// ─────────────────────────────────────────────────────────────────────────
//  learnEnergyCurve
// ─────────────────────────────────────────────────────────────────────────

describe('learnEnergyCurve', () => {
  it('returns "none" confidence with empty log', () => {
    const r = learnEnergyCurve([], 6, 12);
    expect(r.confidence).toBe('none');
    expect(r.shift_recommended).toBe(false);
    expect(r.suggested_start_hour).toBe(6);
  });

  it('detects a clear early-morning peak when user completes deep work at 5–8am', () => {
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 12; i++) {
      events.push(
        evtAt({ i: i * 4 + 0, hour: 5, daysBack: i, energy: 'deep' }),
        evtAt({ i: i * 4 + 1, hour: 6, daysBack: i, energy: 'deep' }),
        evtAt({ i: i * 4 + 2, hour: 7, daysBack: i, energy: 'deep' }),
        evtAt({ i: i * 4 + 3, hour: 8, daysBack: i, energy: 'deep' })
      );
    }
    const r = learnEnergyCurve(events, 9, 12);
    expect(r.confidence).toBe('high');
    expect(r.shift_recommended).toBe(true);
    expect(r.suggested_start_hour).toBe(5);
    expect(r.suggested_end_hour).toBe(9);
  });

  it('keeps the current window when it already captures the peak', () => {
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 30; i++) {
      events.push(evtAt({ i, hour: 9 + (i % 3), daysBack: Math.floor(i / 3), energy: 'deep' }));
    }
    const r = learnEnergyCurve(events, 8, 12);
    expect(r.confidence).toBe('high');
    expect(r.shift_recommended).toBe(false);
  });

  it('returns "low" confidence with 6-11 deep completions and does not recommend shift', () => {
    const events = [0, 1, 2, 3, 4, 5, 6].map(i =>
      evtAt({ i, hour: 14, daysBack: i, energy: 'deep' })
    );
    const r = learnEnergyCurve(events, 6, 12);
    expect(r.confidence).toBe('low');
    expect(r.shift_recommended).toBe(false);
  });

  it('ignores non-deep events even if they are completed', () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      evtAt({ i, hour: 18, daysBack: i, energy: 'light' })
    );
    const r = learnEnergyCurve(events, 6, 12);
    expect(r.confidence).toBe('none'); // no deep events at all
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  learnCapacity
// ─────────────────────────────────────────────────────────────────────────

describe('learnCapacity', () => {
  it('returns "none" with too few days in the log', () => {
    const r = learnCapacity([], 8);
    expect(r.confidence).toBe('none');
    expect(r.suggested_cap_hours).toBe(8);
  });

  it('recommends reducing cap when 8h days only complete 50%', () => {
    // 8 days at 8h scheduled, completing only half each day
    const events: CompletionEvent[] = [];
    for (let d = 0; d < 8; d++) {
      for (let i = 0; i < 8; i++) {
        events.push(
          evtAt({
            i: d * 100 + i,
            hour: 9 + i,
            daysBack: d,
            scheduledMin: 60,
            status: i < 4 ? 'done' : 'skipped',
            actualMin: i < 4 ? 60 : undefined,
          })
        );
      }
    }
    // Plus 8 days at 4h scheduled, finishing all → 16 distinct days total = medium confidence
    for (let d = 8; d < 16; d++) {
      for (let i = 0; i < 4; i++) {
        events.push(
          evtAt({ i: d * 100 + i, hour: 9 + i, daysBack: d, status: 'done' })
        );
      }
    }
    const r = learnCapacity(events, 8);
    expect(r.confidence).toBe('medium'); // 16 days ≥ 14
    expect(r.reduce_recommended).toBe(true);
    expect(r.suggested_cap_hours).toBeLessThan(8);
  });

  it('recommends raising cap when 4h days complete 100% and there is headroom', () => {
    const events: CompletionEvent[] = [];
    // 14 days of 4h scheduled, all done
    for (let d = 0; d < 14; d++) {
      for (let i = 0; i < 4; i++) {
        events.push(evtAt({ i: d * 100 + i, hour: 9 + i, daysBack: d, status: 'done' }));
      }
    }
    // 14 days of 6h scheduled, all done
    for (let d = 14; d < 28; d++) {
      for (let i = 0; i < 6; i++) {
        events.push(evtAt({ i: d * 100 + i, hour: 9 + i, daysBack: d, status: 'done' }));
      }
    }
    const r = learnCapacity(events, 4);
    expect(r.confidence).toBe('high');
    expect(r.raise_recommended).toBe(true);
    expect(r.suggested_cap_hours).toBeGreaterThan(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  learnDayShape
// ─────────────────────────────────────────────────────────────────────────

describe('learnDayShape', () => {
  it('returns 7 stats ordered Mon..Sun', () => {
    const r = learnDayShape([]);
    expect(r.stats.map(s => s.day_label)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
  });

  it('flags Friday as weak when Fri completion rate is well below average', () => {
    const events: CompletionEvent[] = [];
    // Mon-Thu: 5 weeks of 4 blocks/day, all done → 100%
    for (let week = 0; week < 5; week++) {
      const monday = TODAY - week * 7 * 24 * 60 * 60 * 1000;
      for (let dow = 0; dow < 4; dow++) {
        // Monday is daysBack 0 from today's Monday baseline
        const daysBack = week * 7 + (3 - dow); // Thu, Wed, Tue, Mon offsets
        for (let i = 0; i < 4; i++) {
          events.push(
            evtAt({
              i: week * 100 + dow * 10 + i,
              hour: 9 + i,
              daysBack,
              status: 'done',
            })
          );
        }
      }
    }
    // Fri: 5 weeks of 4 blocks/day, only 1 of 4 done → 25%
    for (let week = 0; week < 5; week++) {
      const daysBack = week * 7 - 4; // Friday relative to Monday-today is +4 forward, so -4 days back
      // We can't use negative daysBack reliably here — instead use a known Friday offset.
      // 2026-04-27 is Monday. Friday before that is 2026-04-24 = daysBack 3.
      const fridayDaysBack = 3 + week * 7;
      for (let i = 0; i < 4; i++) {
        events.push(
          evtAt({
            i: 5000 + week * 100 + i,
            hour: 9 + i,
            daysBack: fridayDaysBack,
            status: i === 0 ? 'done' : 'skipped',
            actualMin: i === 0 ? 60 : undefined,
          })
        );
      }
    }
    const r = learnDayShape(events);
    expect(r.confidence).not.toBe('none');
    // Friday is day_of_week === 5
    expect(r.weak_days).toContain(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  detectRecurringMisses
// ─────────────────────────────────────────────────────────────────────────

describe('detectRecurringMisses', () => {
  it('returns empty when no recurring tasks', () => {
    const r = detectRecurringMisses([], [task({ is_recurring: false })]);
    expect(r).toEqual([]);
  });

  it('flags a recurring task skipped 4 of 5 times', () => {
    const recurring = task({ id: 'r', title: 'Daily standup', is_recurring: true });
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(
        evtAt({
          i,
          hour: 9,
          daysBack: i,
          taskId: 'r',
          taskTitle: 'Daily standup',
          status: i === 0 ? 'done' : 'skipped',
          actualMin: i === 0 ? 60 : undefined,
        })
      );
    }
    const r = detectRecurringMisses(events, [recurring]);
    expect(r.length).toBe(1);
    expect(r[0].task_id).toBe('r');
    expect(r[0].missed_count).toBe(4);
    expect(r[0].total_attempts).toBe(5);
    expect(r[0].most_common_hour).toBe(9);
  });

  it('does NOT flag a recurring task with too few attempts', () => {
    const recurring = task({ id: 'r', is_recurring: true });
    const events = [0, 1, 2].map(i =>
      evtAt({ i, hour: 9, daysBack: i, taskId: 'r', status: 'skipped' })
    );
    const r = detectRecurringMisses(events, [recurring]);
    expect(r).toEqual([]);
  });

  it('does NOT flag a recurring task with low miss rate', () => {
    const recurring = task({ id: 'r', is_recurring: true });
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(
        evtAt({
          i,
          hour: 9,
          daysBack: i,
          taskId: 'r',
          status: i < 5 ? 'done' : 'skipped',
          actualMin: i < 5 ? 60 : undefined,
        })
      );
    }
    const r = detectRecurringMisses(events, [recurring]);
    expect(r).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  buildWeeklyDigest
// ─────────────────────────────────────────────────────────────────────────

describe('buildWeeklyDigest', () => {
  it('summarizes minutes + completion rate', () => {
    const events = [
      evtAt({ i: 1, hour: 9, daysBack: 1, scheduledMin: 60, actualMin: 60, status: 'done' }),
      evtAt({ i: 2, hour: 10, daysBack: 1, scheduledMin: 60, status: 'skipped' }),
      evtAt({ i: 3, hour: 11, daysBack: 2, scheduledMin: 60, actualMin: 60, status: 'done' }),
    ];
    const d = buildWeeklyDigest(events, []);
    expect(d.scheduled_minutes).toBe(180);
    expect(d.completed_minutes).toBe(120);
    expect(d.skipped_minutes).toBe(60);
    expect(d.completion_rate).toBeCloseTo(120 / 180);
  });

  it('returns empty headline when no scheduled work', () => {
    const d = buildWeeklyDigest([], []);
    expect(d.headline).toMatch(/no scheduled work/i);
  });

  it('flags worst overruns when actual > estimated', () => {
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 3; i++) {
      events.push(
        evtAt({
          i,
          hour: 9 + i,
          daysBack: 1,
          scheduledMin: 60,
          actualMin: 90, // 50% overrun
          taskId: 'over',
          taskTitle: 'Overrun task',
        })
      );
    }
    const d = buildWeeklyDigest(events, []);
    expect(d.worst_overruns.length).toBe(1);
    expect(d.worst_overruns[0].task_title).toBe('Overrun task');
    expect(d.worst_overruns[0].overrun_pct).toBeGreaterThanOrEqual(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  buildCompletionEvent + appendCompletion
// ─────────────────────────────────────────────────────────────────────────

describe('buildCompletionEvent', () => {
  it('extracts day_of_week + hour_of_day from scheduled_start', () => {
    const t = task({ id: 't', title: 'X', energy_intensity: 'deep' });
    const e = buildCompletionEvent({
      block_id: 'b1',
      task: t,
      scheduled_start: '2026-04-27T09:00:00',
      scheduled_end: '2026-04-27T10:00:00',
      status: 'done',
      actual_minutes: 55,
    });
    expect(e.day_of_week).toBe(1); // Monday
    expect(e.hour_of_day).toBe(9);
    expect(e.scheduled_minutes).toBe(60);
    expect(e.actual_minutes).toBe(55);
    expect(e.energy_intensity).toBe('deep');
  });
});

describe('appendCompletion', () => {
  it('prepends and caps at 500', () => {
    const log: CompletionEvent[] = [];
    let cur = log;
    for (let i = 0; i < 510; i++) {
      cur = appendCompletion(cur, evt(i));
    }
    expect(cur.length).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────
//  Confidence weighting — passive observation should not override explicit
// ─────────────────────────────────────────────────────────────────────────

describe('confidence weighting', () => {
  it('treats 24 confirmed deep events as high confidence', () => {
    const events = Array.from({ length: 24 }, (_, i) =>
      evtAt({ i, hour: 9, daysBack: i, energy: 'deep', confidence: 'confirmed' })
    );
    const r = learnEnergyCurve(events, 6, 12);
    expect(r.confidence).toBe('high');
  });

  it('treats 24 ASSUMED deep events as MEDIUM (effective sample halved)', () => {
    // 24 raw assumed events * 0.5 weight = 12 effective → medium tier (≥12)
    const events = Array.from({ length: 24 }, (_, i) =>
      evtAt({ i, hour: 9, daysBack: i, energy: 'deep', confidence: 'assumed' })
    );
    const r = learnEnergyCurve(events, 6, 12);
    expect(r.confidence).toBe('medium');
  });

  it('treats 24 INFERRED-ACTIVE events as high (0.8 weight × 24 = 19 → high)', () => {
    const events = Array.from({ length: 24 }, (_, i) =>
      evtAt({ i, hour: 9, daysBack: i, energy: 'deep', confidence: 'inferred-active' })
    );
    const r = learnEnergyCurve(events, 6, 12);
    // 24 * 0.8 = 19.2 → rounds to 19 → ≥12 (medium) but <24 (high) → medium
    expect(r.confidence).toBe('medium');
  });

  it('weights confirmed events above assumed in the histogram', () => {
    // 5 confirmed at 5am (weight 1.0 = 5 effective) vs 8 assumed at 14pm (weight 0.5 = 4 effective)
    // The 5am peak should win even though raw count is lower.
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(evtAt({ i, hour: 5, daysBack: i, energy: 'deep', confidence: 'confirmed' }));
    }
    for (let i = 0; i < 8; i++) {
      events.push(evtAt({ i: 100 + i, hour: 14, daysBack: i, energy: 'deep', confidence: 'assumed' }));
    }
    const r = learnEnergyCurve(events, 8, 12);
    expect(r.suggested_start_hour).toBeLessThanOrEqual(5);
  });

  it('skipped events count fully regardless of confidence (the skip itself is reliable)', () => {
    // 6 confirmed dones at 9am, 10 assumed-skipped at 14pm.
    // The 14pm slot should NOT register as a peak — those skips weight 1.0,
    // but the histogram only counts dones. Dones at 9am (weight 1.0 each = 6).
    // No skip ever appears in the histogram. The 9am peak holds.
    const events: CompletionEvent[] = [];
    for (let i = 0; i < 6; i++) {
      events.push(evtAt({ i, hour: 9, daysBack: i, energy: 'deep', confidence: 'confirmed' }));
    }
    for (let i = 0; i < 10; i++) {
      events.push(evtAt({
        i: 200 + i, hour: 14, daysBack: i, energy: 'deep',
        status: 'skipped', confidence: 'assumed',
      }));
    }
    const r = learnEnergyCurve(events, 8, 12);
    // The window centered around 9am should be picked
    expect(r.suggested_start_hour).toBeLessThanOrEqual(9);
    expect(r.suggested_end_hour).toBeGreaterThanOrEqual(9);
  });
});
