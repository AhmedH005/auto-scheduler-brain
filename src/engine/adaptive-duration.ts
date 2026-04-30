/**
 * Adaptive duration learning.
 *
 * Tracks every completed block's actual duration vs. estimated duration.
 * When the user creates or edits a task with a similar title, surface a
 * realistic estimate based on history: median actual minutes for similar
 * tasks, blended with the user's stated estimate to keep the suggestion
 * stable when sample size is low.
 *
 * Storage is localStorage-only (key: axis_duration_log). Capped at 200
 * most-recent entries to prevent unbounded growth on long-running users.
 *
 * This is the planning-fallacy fix that competitors (Motion, Reclaim)
 * don't currently do well.
 */

import { Task, DurationLog, DurationSuggestion, EnergyIntensity } from '@/types/task';

const MAX_LOG_ENTRIES = 200;
const HIGH_CONFIDENCE_SAMPLES = 5;
const MEDIUM_CONFIDENCE_SAMPLES = 2;

/** Loose match: shared lowercase word stems, ignoring filler words. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'in', 'on', 'at', 'to', 'with',
  'and', 'or', 'but', 'task', 'work', 'do',
]);

function stems(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOPWORDS.has(w))
      // Drop simple plural / -ing / -ed endings to widen matches
      .map(w => w.replace(/(?:ing|ed|s)$/i, ''))
  );
}

export function titlesSimilar(a: string, b: string): boolean {
  const aStems = stems(a);
  const bStems = stems(b);
  if (aStems.size === 0 || bStems.size === 0) return false;
  let overlap = 0;
  for (const s of aStems) if (bStems.has(s)) overlap++;
  // At least one meaningful word in common, AND that word covers ≥60% of the
  // smaller title's stems (so "Read email" doesn't match "Read code" via "read"
  // alone — the cohort needs to share more than a single common verb).
  const minSize = Math.min(aStems.size, bStems.size);
  return overlap >= 1 && overlap / minSize >= 0.6;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Add a completion record to the log. Returns the new log (caller persists).
 */
export function recordCompletion(
  log: DurationLog[],
  entry: Omit<DurationLog, 'id' | 'completed_at'> & { completed_at?: string }
): DurationLog[] {
  const newLog: DurationLog = {
    id: `dur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    completed_at: entry.completed_at ?? new Date().toISOString(),
    task_id: entry.task_id,
    task_title: entry.task_title,
    estimated_minutes: entry.estimated_minutes,
    actual_minutes: entry.actual_minutes,
    energy_intensity: entry.energy_intensity,
  };
  // Prepend, cap at MAX_LOG_ENTRIES
  return [newLog, ...log].slice(0, MAX_LOG_ENTRIES);
}

/**
 * Suggest a realistic duration for a task, blending the user's estimate with
 * historical performance. Returns null only when there is literally no signal
 * (no logs at all and no estimate to bias from).
 */
export function suggestDuration(
  task: Pick<Task, 'id' | 'title' | 'total_duration' | 'energy_intensity'>,
  log: DurationLog[]
): DurationSuggestion {
  const estimate = task.total_duration;

  // 1) Same task by id (strongest signal)
  const taskMatches = log.filter(l => l.task_id === task.id);
  if (taskMatches.length >= MEDIUM_CONFIDENCE_SAMPLES) {
    const m = median(taskMatches.map(l => l.actual_minutes));
    const blend = taskMatches.length >= HIGH_CONFIDENCE_SAMPLES ? 0.85 : 0.6;
    const suggested = Math.round(m * blend + estimate * (1 - blend));
    return {
      estimated_minutes: estimate,
      suggested_minutes: suggested,
      delta_pct: pctDelta(estimate, suggested),
      confidence: taskMatches.length >= HIGH_CONFIDENCE_SAMPLES ? 'high' : 'medium',
      sample_size: taskMatches.length,
      source: 'task-specific',
    };
  }

  // 2) Similar titles (medium signal)
  const titleMatches = log.filter(l => l.task_id !== task.id && titlesSimilar(l.task_title, task.title));
  if (titleMatches.length >= MEDIUM_CONFIDENCE_SAMPLES) {
    const m = median(titleMatches.map(l => l.actual_minutes));
    const blend = 0.5;
    const suggested = Math.round(m * blend + estimate * (1 - blend));
    return {
      estimated_minutes: estimate,
      suggested_minutes: suggested,
      delta_pct: pctDelta(estimate, suggested),
      confidence: 'medium',
      sample_size: titleMatches.length,
      source: 'task-specific',
    };
  }

  // 3) Same energy cohort (weak signal — global tendency to over/underestimate)
  const cohort = log.filter(l => l.energy_intensity === task.energy_intensity);
  if (cohort.length >= HIGH_CONFIDENCE_SAMPLES) {
    // Compute average over/underestimate ratio in this cohort
    const ratios = cohort.map(l => l.actual_minutes / Math.max(l.estimated_minutes, 1));
    const ratio = median(ratios);
    if (ratio > 1.05 || ratio < 0.95) {
      const suggested = Math.round(estimate * ratio);
      return {
        estimated_minutes: estimate,
        suggested_minutes: suggested,
        delta_pct: pctDelta(estimate, suggested),
        confidence: 'low',
        sample_size: cohort.length,
        source: 'energy-cohort',
      };
    }
  }

  // 4) No useful signal — return estimate as-is
  return {
    estimated_minutes: estimate,
    suggested_minutes: estimate,
    delta_pct: 0,
    confidence: 'none',
    sample_size: log.length,
    source: 'fallback',
  };
}

function pctDelta(a: number, b: number): number {
  if (a === 0) return 0;
  return Math.round(((b - a) / a) * 100);
}

/**
 * Detect users whose estimates are systematically off, for surfacing as a
 * coaching nudge in weekly review (planning-fallacy education).
 */
export function summarizeAccuracy(log: DurationLog[]): {
  sample_size: number;
  median_overrun_pct: number;
  worst_category: { energy: EnergyIntensity; overrun_pct: number } | null;
} {
  if (log.length < 5) return { sample_size: log.length, median_overrun_pct: 0, worst_category: null };
  const ratios = log.map(l => l.actual_minutes / Math.max(l.estimated_minutes, 1));
  const overrun = (median(ratios) - 1) * 100;

  // Worst-category: energy bucket with highest median overrun
  const byEnergy: Record<EnergyIntensity, number[]> = { deep: [], moderate: [], light: [] };
  log.forEach(l => byEnergy[l.energy_intensity].push(l.actual_minutes / Math.max(l.estimated_minutes, 1)));

  let worst: { energy: EnergyIntensity; overrun_pct: number } | null = null;
  (['deep', 'moderate', 'light'] as EnergyIntensity[]).forEach(e => {
    if (byEnergy[e].length < 3) return;
    const cohortOverrun = (median(byEnergy[e]) - 1) * 100;
    if (!worst || cohortOverrun > worst.overrun_pct) {
      worst = { energy: e, overrun_pct: Math.round(cohortOverrun) };
    }
  });

  return {
    sample_size: log.length,
    median_overrun_pct: Math.round(overrun),
    worst_category: worst,
  };
}
