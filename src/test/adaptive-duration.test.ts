import { describe, it, expect } from 'vitest';
import {
  recordCompletion,
  suggestDuration,
  titlesSimilar,
  summarizeAccuracy,
} from '@/engine/adaptive-duration';
import { Task, DurationLog, EnergyIntensity } from '@/types/task';

const TASK_BASE = {
  id: 't1',
  title: 'Read research paper',
  total_duration: 60,
  energy_intensity: 'deep' as EnergyIntensity,
};

const log = (
  i: number,
  task_id: string,
  task_title: string,
  estimated: number,
  actual: number,
  energy: EnergyIntensity = 'deep'
): DurationLog => ({
  id: `dur-${i}`,
  task_id,
  task_title,
  estimated_minutes: estimated,
  actual_minutes: actual,
  energy_intensity: energy,
  completed_at: new Date(2026, 3, 20 - i).toISOString(),
});

describe('titlesSimilar', () => {
  it('matches stems with shared meaningful words', () => {
    expect(titlesSimilar('Read research paper', 'Read the research')).toBe(true);
    expect(titlesSimilar('Code review', 'Review the code')).toBe(true);
  });

  it('does not match purely on stopwords', () => {
    expect(titlesSimilar('The thing for work', 'A thing in work')).toBe(true); // "thing" + "work" overlap
    expect(titlesSimilar('Read email', 'Read code')).toBe(false); // only "read", coverage too low
  });

  it('handles empty / single-word titles', () => {
    expect(titlesSimilar('', 'something')).toBe(false);
    expect(titlesSimilar('thesis', 'thesis')).toBe(true);
  });
});

describe('recordCompletion', () => {
  it('prepends the new entry and assigns id + completed_at', () => {
    const before: DurationLog[] = [];
    const after = recordCompletion(before, {
      task_id: 't1',
      task_title: 'X',
      estimated_minutes: 30,
      actual_minutes: 45,
      energy_intensity: 'moderate',
    });
    expect(after.length).toBe(1);
    expect(after[0].id).toMatch(/^dur-/);
    expect(after[0].completed_at).toBeDefined();
    expect(after[0].actual_minutes).toBe(45);
  });

  it('caps the log at 200 entries (drops oldest)', () => {
    let log: DurationLog[] = [];
    for (let i = 0; i < 220; i++) {
      log = recordCompletion(log, {
        task_id: 't',
        task_title: 'X',
        estimated_minutes: 30,
        actual_minutes: 30,
        energy_intensity: 'light',
      });
    }
    expect(log.length).toBe(200);
  });
});

describe('suggestDuration', () => {
  it('returns fallback (estimate as-is) when no logs exist', () => {
    const sug = suggestDuration(TASK_BASE, []);
    expect(sug.suggested_minutes).toBe(60);
    expect(sug.confidence).toBe('none');
    expect(sug.source).toBe('fallback');
  });

  it('uses task-specific median when ≥5 same-task logs (high confidence)', () => {
    const logs = [
      log(1, 't1', 'Read research paper', 60, 80),
      log(2, 't1', 'Read research paper', 60, 90),
      log(3, 't1', 'Read research paper', 60, 75),
      log(4, 't1', 'Read research paper', 60, 100),
      log(5, 't1', 'Read research paper', 60, 85),
    ];
    const sug = suggestDuration(TASK_BASE, logs);
    expect(sug.confidence).toBe('high');
    expect(sug.source).toBe('task-specific');
    expect(sug.suggested_minutes).toBeGreaterThan(60); // history says it actually takes longer
    expect(sug.delta_pct).toBeGreaterThan(0);
  });

  it('blends estimate + history at medium confidence (2-4 same-task logs)', () => {
    const logs = [
      log(1, 't1', 'Read research paper', 60, 90),
      log(2, 't1', 'Read research paper', 60, 90),
    ];
    const sug = suggestDuration(TASK_BASE, logs);
    expect(sug.confidence).toBe('medium');
    expect(sug.source).toBe('task-specific');
    // 0.6 weight on history (90), 0.4 weight on estimate (60) ≈ 78
    expect(sug.suggested_minutes).toBeGreaterThan(60);
    expect(sug.suggested_minutes).toBeLessThan(90);
  });

  it('falls back to similar-title cohort when same-task is empty', () => {
    const logs = [
      log(1, 'other-1', 'Read economics paper', 60, 80),
      log(2, 'other-2', 'Read research paper notes', 60, 75),
    ];
    const sug = suggestDuration(TASK_BASE, logs);
    expect(sug.source).toBe('task-specific'); // matched by title cohort
    expect(sug.confidence).toBe('medium');
  });

  it('uses energy-cohort ratio when no title match but ≥5 same-energy logs', () => {
    const logs: DurationLog[] = [];
    for (let i = 0; i < 6; i++) {
      logs.push(log(i, `other-${i}`, `Unrelated ${i}`, 60, 90, 'deep')); // 50% overrun
    }
    const sug = suggestDuration(TASK_BASE, logs);
    expect(sug.source).toBe('energy-cohort');
    expect(sug.confidence).toBe('low');
    expect(sug.suggested_minutes).toBeGreaterThanOrEqual(85); // ~60 * 1.5
  });
});

describe('summarizeAccuracy', () => {
  it('returns zeros when sample size < 5', () => {
    const result = summarizeAccuracy([log(1, 't', 'X', 60, 80)]);
    expect(result.median_overrun_pct).toBe(0);
    expect(result.worst_category).toBeNull();
  });

  it('reports median overrun + worst-category cohort', () => {
    const logs: DurationLog[] = [];
    // 3 deep tasks, all 50% overrun
    for (let i = 0; i < 3; i++) logs.push(log(i, `d-${i}`, `Deep ${i}`, 60, 90, 'deep'));
    // 3 light tasks, perfectly estimated
    for (let i = 0; i < 3; i++) logs.push(log(i + 3, `l-${i}`, `Light ${i}`, 30, 30, 'light'));
    const result = summarizeAccuracy(logs);
    expect(result.sample_size).toBe(6);
    expect(result.worst_category?.energy).toBe('deep');
    expect(result.worst_category?.overrun_pct).toBeGreaterThanOrEqual(50);
  });
});
