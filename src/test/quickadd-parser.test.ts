import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { parseQuickAdd } from '@/engine/quickadd-parser';

// 2026-05-04 = Monday. Lock so day-of-week resolution is deterministic.
const NOW = new Date('2026-05-04T10:00:00');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('parseQuickAdd — title extraction', () => {
  it('uses the whole input as title when nothing else matches', () => {
    const r = parseQuickAdd('Just a normal task');
    expect(r.title).toBe('Just a normal task');
    expect(r.duration).toBe(30);
    expect(r.deadline).toBeNull();
  });

  it('strips matched tokens from the title', () => {
    const r = parseQuickAdd('Read research paper 90min by Friday');
    expect(r.title).toBe('Read research paper');
  });
});

describe('parseQuickAdd — duration', () => {
  it('parses "90min"', () => {
    const r = parseQuickAdd('Foo 90min');
    expect(r.duration).toBe(90);
    expect(r.matched.duration).toBe(true);
  });
  it('parses "1.5h"', () => {
    const r = parseQuickAdd('Foo 1.5h');
    expect(r.duration).toBe(90);
  });
  it('parses "for 2 hours"', () => {
    const r = parseQuickAdd('Foo for 2 hours');
    expect(r.duration).toBe(120);
  });
  it('falls back to 30 min default', () => {
    const r = parseQuickAdd('Foo');
    expect(r.duration).toBe(30);
    expect(r.matched.duration).toBe(false);
  });
});

describe('parseQuickAdd — deadline', () => {
  it('parses "by tomorrow"', () => {
    const r = parseQuickAdd('Task by tomorrow');
    expect(r.deadline).toBe('2026-05-05');
    expect(r.matched.deadline).toBe(true);
  });
  it('parses "by Friday" → next Friday', () => {
    const r = parseQuickAdd('Task by Friday');
    expect(r.deadline).toBe('2026-05-08');
  });
  it('parses "by next Tuesday"', () => {
    const r = parseQuickAdd('Task by next Tuesday');
    // Today is Monday May 4. "next Tuesday" = May 5
    expect(r.deadline).toBe('2026-05-05');
  });
  it('parses "in 3 days"', () => {
    const r = parseQuickAdd('Task in 3 days');
    expect(r.deadline).toBe('2026-05-07');
  });
  it('parses "in 2 weeks"', () => {
    const r = parseQuickAdd('Task in 2 weeks');
    expect(r.deadline).toBe('2026-05-18');
  });
  it('parses "by 5/12"', () => {
    const r = parseQuickAdd('Task by 5/12');
    expect(r.deadline).toBe('2026-05-12');
  });
});

describe('parseQuickAdd — recurring', () => {
  it('parses "every weekday"', () => {
    const r = parseQuickAdd('Email triage every weekday');
    expect(r.recurring?.pattern).toBe('weekdays');
    expect(r.matched.recurring).toBe(true);
  });
  it('parses "daily"', () => {
    const r = parseQuickAdd('Stretching daily');
    expect(r.recurring?.pattern).toBe('daily');
  });
  it('parses "every Monday"', () => {
    const r = parseQuickAdd('Team standup every Monday');
    expect(r.recurring?.pattern).toBe('weekly');
  });
});

describe('parseQuickAdd — fixed time', () => {
  it('parses "tomorrow at 14:00"', () => {
    const r = parseQuickAdd('Lunch tomorrow at 14:00');
    expect(r.scheduling_mode).toBe('fixed');
    expect(r.start_datetime).toBe('2026-05-05T14:00:00');
    expect(r.matched.fixed_time).toBe(true);
  });
  it('parses "at 3pm" → today 15:00', () => {
    const r = parseQuickAdd('Standup at 3pm');
    expect(r.scheduling_mode).toBe('fixed');
    expect(r.start_datetime).toBe('2026-05-04T15:00:00');
  });
  it('infers PM for hours 1-7 without am/pm marker', () => {
    const r = parseQuickAdd('Call at 3');
    // 3 → assume PM → 15:00
    expect(r.start_datetime).toBe('2026-05-04T15:00:00');
  });
});

describe('parseQuickAdd — priority', () => {
  it('parses "urgent"', () => {
    const r = parseQuickAdd('Bug fix urgent');
    expect(r.priority).toBe(5);
    expect(r.matched.priority).toBe(true);
  });
  it('parses "low priority"', () => {
    const r = parseQuickAdd('Cleanup low priority');
    expect(r.priority).toBe(2);
  });
  it('parses "p1"', () => {
    const r = parseQuickAdd('Fix bug p1');
    expect(r.priority).toBe(5);
  });
  it('defaults to 3', () => {
    const r = parseQuickAdd('Random task');
    expect(r.priority).toBe(3);
    expect(r.matched.priority).toBe(false);
  });
});

describe('parseQuickAdd — energy inference', () => {
  it('infers deep from "research"', () => {
    const r = parseQuickAdd('Read research paper');
    expect(r.energy).toBe('deep');
    expect(r.matched.energy).toBe(true);
  });
  it('infers light from "email"', () => {
    const r = parseQuickAdd('Reply to emails');
    expect(r.energy).toBe('light');
  });
  it('infers moderate from "meeting"', () => {
    const r = parseQuickAdd('Sprint planning meeting');
    expect(r.energy).toBe('moderate');
  });
  it('falls back to moderate when nothing matches', () => {
    const r = parseQuickAdd('Random thing');
    expect(r.energy).toBe('moderate');
    expect(r.matched.energy).toBe(false);
  });
});

describe('parseQuickAdd — composition', () => {
  it('extracts everything from a fully-specified line', () => {
    const r = parseQuickAdd('Read research paper 90min by Friday urgent');
    expect(r.title).toBe('Read research paper');
    expect(r.duration).toBe(90);
    expect(r.deadline).toBe('2026-05-08');
    expect(r.priority).toBe(5);
    expect(r.energy).toBe('deep');
  });

  it('handles recurring + fixed time + duration', () => {
    const r = parseQuickAdd('Daily standup at 9 15min every weekday');
    expect(r.duration).toBe(15);
    expect(r.recurring?.pattern).toBe('weekdays');
    expect(r.scheduling_mode).toBe('fixed');
  });
});
