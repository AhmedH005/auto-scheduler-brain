import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { interpret } from '@/engine/assistant';

const NOW = new Date('2026-05-04T10:00:00');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe('interpret — replan', () => {
  it('routes "replan now" to scope=now', () => {
    const t = interpret('replan now');
    expect(t.intent.kind).toBe('replan');
    if (t.intent.kind === 'replan') expect(t.intent.scope).toBe('now');
  });
  it('routes "fix my schedule" to scope=today', () => {
    const t = interpret('fix my schedule');
    expect(t.intent.kind).toBe('replan');
    if (t.intent.kind === 'replan') expect(t.intent.scope).toBe('today');
  });
});

describe('interpret — undo', () => {
  it('routes "undo"', () => {
    expect(interpret('undo').intent.kind).toBe('undo');
  });
  it('routes "wait, no"', () => {
    expect(interpret('wait, no').intent.kind).toBe('undo');
  });
  it('routes "never mind"', () => {
    expect(interpret('never mind').intent.kind).toBe('undo');
  });
});

describe('interpret — completion / skip / delete', () => {
  it('routes "I finished sprint planning"', () => {
    const t = interpret('I finished sprint planning');
    expect(t.intent.kind).toBe('complete');
    if (t.intent.kind === 'complete') expect(t.intent.query).toBe('sprint planning');
  });
  it('routes "done with the paper"', () => {
    const t = interpret('done with the paper');
    expect(t.intent.kind).toBe('complete');
  });
  it('routes "skip email triage"', () => {
    const t = interpret('skip email triage');
    expect(t.intent.kind).toBe('skip');
    if (t.intent.kind === 'skip') expect(t.intent.query).toBe('email triage');
  });
  it('routes "delete sprint planning"', () => {
    const t = interpret('delete sprint planning');
    expect(t.intent.kind).toBe('delete');
  });
  it('routes "remove the standup"', () => {
    const t = interpret('remove the standup');
    expect(t.intent.kind).toBe('delete');
  });
});

describe('interpret — day shape', () => {
  it('routes "easy day today" to ease', () => {
    expect(interpret('easy day today').intent.kind).toBe('ease');
  });
  it('routes "light day" to ease', () => {
    expect(interpret('light day').intent.kind).toBe('ease');
  });
  it('routes "heavy day" to push', () => {
    expect(interpret('heavy day').intent.kind).toBe('push');
  });
  it('routes "big day" to push', () => {
    expect(interpret('big day').intent.kind).toBe('push');
  });
});

describe('interpret — queries', () => {
  it('routes "what\'s next" to query_next', () => {
    expect(interpret("what's next").intent.kind).toBe('query_next');
  });
  it('routes "what\'s on today" to query_today', () => {
    expect(interpret("what's on today").intent.kind).toBe('query_today');
  });
  it('routes "this week" to query_week', () => {
    expect(interpret('this week').intent.kind).toBe('query_week');
  });
  it('routes "what am I doing" to query_now', () => {
    expect(interpret('what am I doing').intent.kind).toBe('query_now');
  });
});

describe('interpret — show_* lens commands', () => {
  it('routes "show tasks" to show_tasks', () => {
    expect(interpret('show tasks').intent.kind).toBe('show_tasks');
  });
  it('routes "open inbox" to show_tasks', () => {
    expect(interpret('open inbox').intent.kind).toBe('show_tasks');
  });
  it('routes "show calendar" to show_calendar', () => {
    expect(interpret('show calendar').intent.kind).toBe('show_calendar');
  });
  it('routes "open week" to show_calendar', () => {
    expect(interpret('open week').intent.kind).toBe('show_calendar');
  });
  it('routes "show insights" to show_insights', () => {
    expect(interpret('show insights').intent.kind).toBe('show_insights');
  });
  it('routes "open retro" to show_insights', () => {
    expect(interpret('open retro').intent.kind).toBe('show_insights');
  });
  it('routes "show settings" to show_settings', () => {
    expect(interpret('show settings').intent.kind).toBe('show_settings');
  });
  it('routes "connect google" to show_integrations', () => {
    expect(interpret('connect google').intent.kind).toBe('show_integrations');
  });
});

describe('interpret — fallback to add', () => {
  it('treats novel input as an add', () => {
    const t = interpret('Read research paper 90min by Friday');
    expect(t.intent.kind).toBe('add');
    if (t.intent.kind === 'add') {
      expect(t.intent.task.title).toBe('Read research paper');
      expect(t.intent.task.duration).toBe(90);
    }
  });
  it('returns a confirmation speech for adds', () => {
    const t = interpret('Lunch tomorrow at 12:30');
    expect(t.speech).toContain('Lunch');
    expect(t.speech).toContain('Slotting');
  });
});
