/**
 * Learning layer — pure inference over the user's CompletionEvent history.
 *
 * Five loops:
 *   1. learnEnergyCurve       → "your real deep window" (replaces static 6–12)
 *   2. learnCapacity          → "you finish 90% at 6h, 60% at 8h — try 6h"
 *   3. learnDayShape          → per-DOW completion rates ("Fridays slip")
 *   4. detectRecurringMisses  → recurring tasks the user keeps skipping
 *   5. buildWeeklyDigest      → sentence-style summary for the retro surface
 *
 * Design decisions, all per AGENTS.md:
 *   - Deterministic. Same input → same output. No randomness, no ML.
 *   - Confidence-aware. Returns 'none' / 'low' / 'medium' / 'high' so the
 *     UI can decide whether to surface or stay quiet.
 *   - Suggest-only. Never auto-applies. Surfaces nudges; user clicks to apply.
 *     This matches AGENTS.md "review-first adaptation" — the system can
 *     observe and propose, but the user owns the schedule.
 *   - Sample-size gates. Below the relevant threshold the function returns
 *     low/none confidence rather than fabricating signal from 2 data points.
 */

import {
  Task,
  CompletionEvent,
  CompletionConfidence,
  EnergySuggestion,
  CapacitySuggestion,
  DayShape,
  DayShapeStat,
  MissedPattern,
  WeeklyDigest,
  Confidence,
  UserSettings,
} from '@/types/task';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

const isDone = (e: CompletionEvent) => e.status === 'done' || e.status === 'partial';

/**
 * Weight an event by how reliably we know it happened. Confirmed taps go
 * full strength; passive inference is downweighted because we might be
 * wrong. Skipped events count fully — that signal IS reliable (the user
 * told us so).
 */
export function confidenceWeight(c: CompletionConfidence | undefined): number {
  switch (c) {
    case 'confirmed': return 1.0;
    case 'inferred-active': return 0.8;
    case 'assumed': return 0.5;
    default: return 0.5;
  }
}

const eventWeight = (e: CompletionEvent): number =>
  e.status === 'skipped' ? 1.0 : confidenceWeight(e.confidence);

function scoreConfidence(samples: number, low: number, medium: number, high: number): Confidence {
  if (samples >= high) return 'high';
  if (samples >= medium) return 'medium';
  if (samples >= low) return 'low';
  return 'none';
}

function isoDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────
//  1. learnEnergyCurve
// ─────────────────────────────────────────────────────────────────────────

/**
 * Learn the user's actual deep window from completed deep blocks.
 *
 * Algorithm:
 *  - Take all 'done' or 'partial' events with energy='deep'.
 *  - For each hour 0..23, count completions whose scheduled_start landed there.
 *  - Find the contiguous WINDOW_HOURS-wide window with maximum completions.
 *  - Compare to the current configured deep window.
 *
 * Sample-size gating prevents flapping the deep window from noise — at
 * <10 deep completions we just keep the current window.
 */
export function learnEnergyCurve(
  events: CompletionEvent[],
  currentStartHour: number,
  currentEndHour: number,
  windowHours = 4
): EnergySuggestion {
  const deepDone = events.filter(e => e.energy_intensity === 'deep' && isDone(e));

  // Effective sample size weighs assumed events less. With only assumed
  // events, 12 raw observations count as 6 effective — which is why
  // confirmed/active completions matter more than passive ticks.
  const effective_sample = deepDone.reduce((a, e) => a + eventWeight(e), 0);
  const sample_size = Math.round(effective_sample);
  const confidence = scoreConfidence(sample_size, 6, 12, 24);

  // No useful signal — keep the current window
  if (confidence === 'none') {
    return {
      current_start_hour: currentStartHour,
      current_end_hour: currentEndHour,
      suggested_start_hour: currentStartHour,
      suggested_end_hour: currentEndHour,
      shift_recommended: false,
      confidence: 'none',
      sample_size,
      reason: 'Not enough deep-work history yet — keep current window.',
    };
  }

  // Hourly completion histogram (0..23) — weighted by confidence so
  // confirmed events pull the curve harder than assumed ones.
  const hourly = new Array<number>(24).fill(0);
  for (const e of deepDone) {
    const h = Math.max(0, Math.min(23, e.hour_of_day));
    hourly[h] += eventWeight(e);
  }

  // Sliding window: find contiguous windowHours-block with max sum
  let bestStart = currentStartHour;
  let bestSum = -1;
  for (let s = 0; s + windowHours <= 24; s++) {
    let sum = 0;
    for (let i = 0; i < windowHours; i++) sum += hourly[s + i];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = s;
    }
  }
  const suggestedEnd = bestStart + windowHours;

  // "Shift recommended" only if (a) different window AND (b) at least
  // medium confidence AND (c) the new window has noticeably more density.
  const currentWindowSum = hourly
    .slice(currentStartHour, currentEndHour)
    .reduce((a, b) => a + b, 0);
  const liftRatio = currentWindowSum > 0 ? bestSum / currentWindowSum : Infinity;
  const distinct = bestStart !== currentStartHour || suggestedEnd !== currentEndHour;
  const shift_recommended =
    distinct && confidence !== 'low' && (liftRatio >= 1.4 || currentWindowSum === 0);

  const reason = shift_recommended
    ? `You complete ${bestSum} of your last ${sample_size} deep blocks within ${formatHour(bestStart)}–${formatHour(suggestedEnd)} — vs. ${currentWindowSum} in your current window.`
    : `Your current window already captures most of your real peak (${currentWindowSum} of ${sample_size}). Holding it.`;

  return {
    current_start_hour: currentStartHour,
    current_end_hour: currentEndHour,
    suggested_start_hour: bestStart,
    suggested_end_hour: suggestedEnd,
    shift_recommended,
    confidence,
    sample_size,
    reason,
  };
}

function formatHour(h: number): string {
  const hh = String(h).padStart(2, '0');
  return `${hh}:00`;
}

// ─────────────────────────────────────────────────────────────────────────
//  2. learnCapacity
// ─────────────────────────────────────────────────────────────────────────

/**
 * Learn the daily-cap that gives a sustainable completion rate.
 *
 * Algorithm:
 *  - Group events by date.
 *  - For each date, compute scheduled_minutes (sum of all events that day)
 *    and completed_minutes (sum of actual_minutes for done/partial).
 *  - Bucket dates by scheduled-hours-rounded ({4, 5, 6, 7, 8, 9, 10, 11, 12}).
 *  - Compute mean completion rate per bucket.
 *  - Suggest the highest bucket that maintains ≥75% completion.
 *
 * Why 75%: empirical. 100% is unrealistic; 50% means the schedule is fiction.
 * 75% is a target that's ambitious but trustable.
 */
const COMPLETION_RATE_TARGET = 0.75;

export function learnCapacity(
  events: CompletionEvent[],
  currentCapHours: number
): CapacitySuggestion {
  // Group by ISO date
  const byDate = new Map<string, { scheduled: number; completed: number }>();
  for (const e of events) {
    const date = isoDate(e.scheduled_start);
    const cur = byDate.get(date) ?? { scheduled: 0, completed: 0 };
    cur.scheduled += e.scheduled_minutes;
    if (isDone(e)) cur.completed += e.actual_minutes ?? e.scheduled_minutes;
    byDate.set(date, cur);
  }

  const sample_size = byDate.size;
  const confidence = scoreConfidence(sample_size, 5, 14, 28);

  if (confidence === 'none') {
    return {
      current_cap_hours: currentCapHours,
      suggested_cap_hours: currentCapHours,
      completion_rate_at_current: 0,
      completion_rate_at_suggested: 0,
      reduce_recommended: false,
      raise_recommended: false,
      confidence: 'none',
      sample_size,
      reason: 'Not enough day-level history to suggest a cap.',
    };
  }

  // Bucket by rounded scheduled hours
  type Bucket = { hours: number; rates: number[] };
  const buckets = new Map<number, Bucket>();
  for (const [, day] of byDate) {
    if (day.scheduled === 0) continue;
    const hours = Math.round(day.scheduled / 60);
    const rate = day.completed / day.scheduled;
    const b = buckets.get(hours) ?? { hours, rates: [] };
    b.rates.push(rate);
    buckets.set(hours, b);
  }

  // Compute mean rate per bucket; require ≥2 days per bucket to be considered
  const bucketStats = Array.from(buckets.values())
    .filter(b => b.rates.length >= 2)
    .map(b => ({
      hours: b.hours,
      rate: b.rates.reduce((a, c) => a + c, 0) / b.rates.length,
      n: b.rates.length,
    }))
    .sort((a, b) => a.hours - b.hours);

  // The current cap's completion rate (or its closest bucket)
  const currentBucket = bucketStats.find(b => b.hours === currentCapHours)
    ?? bucketStats.reduce((nearest, b) =>
      Math.abs(b.hours - currentCapHours) < Math.abs(nearest.hours - currentCapHours) ? b : nearest,
      bucketStats[0] ?? { hours: currentCapHours, rate: 0, n: 0 });

  // Suggested = highest bucket that holds ≥ target
  const sustained = bucketStats.filter(b => b.rate >= COMPLETION_RATE_TARGET);
  const suggested = sustained.length > 0
    ? sustained[sustained.length - 1]
    : bucketStats[0] ?? { hours: currentCapHours, rate: 0, n: 0 };

  // Only surface recommendations at medium+ confidence — at low (5-13 days)
  // we have a directional signal but not enough to credibly nudge a cap change.
  const enoughConfidence = confidence === 'medium' || confidence === 'high';
  const reduce_recommended =
    enoughConfidence && suggested.hours < currentCapHours && currentBucket.rate < COMPLETION_RATE_TARGET;
  const raise_recommended =
    enoughConfidence && suggested.hours > currentCapHours && currentBucket.rate >= 0.9;

  let reason: string;
  if (reduce_recommended) {
    reason = `At ${currentCapHours}h cap you finish ${Math.round(currentBucket.rate * 100)}% of scheduled work. At ${suggested.hours}h you'd hit ${Math.round(suggested.rate * 100)}%.`;
  } else if (raise_recommended) {
    reason = `You're consistently finishing ${Math.round(currentBucket.rate * 100)}% at ${currentCapHours}h — there's headroom. ${suggested.hours}h still holds ${Math.round(suggested.rate * 100)}%.`;
  } else {
    reason = `At ${currentCapHours}h cap you finish ${Math.round(currentBucket.rate * 100)}%. Holding.`;
  }

  return {
    current_cap_hours: currentCapHours,
    suggested_cap_hours: suggested.hours,
    completion_rate_at_current: currentBucket.rate,
    completion_rate_at_suggested: suggested.rate,
    reduce_recommended,
    raise_recommended,
    confidence,
    sample_size,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  3. learnDayShape
// ─────────────────────────────────────────────────────────────────────────

/**
 * Per-day-of-week completion rate. Surfaces "your Fridays underperform" in
 * a way the user can act on (move heavy work elsewhere, declare lighter
 * Fridays as the default, etc.).
 */
export function learnDayShape(events: CompletionEvent[]): DayShape {
  const sample_size = events.length;
  const confidence = scoreConfidence(sample_size, 14, 30, 60);

  // Aggregate per DOW
  const byDow = new Array<{ scheduled: number; completed: number; samples: number; daysSeen: Set<string> }>(7);
  for (let i = 0; i < 7; i++) byDow[i] = { scheduled: 0, completed: 0, samples: 0, daysSeen: new Set() };

  for (const e of events) {
    const d = byDow[e.day_of_week];
    d.scheduled += e.scheduled_minutes;
    if (isDone(e)) d.completed += e.actual_minutes ?? e.scheduled_minutes;
    d.samples += 1;
    d.daysSeen.add(isoDate(e.scheduled_start));
  }

  // Order: Mon..Sun (more ergonomic for users)
  const order = [1, 2, 3, 4, 5, 6, 0];
  const stats: DayShapeStat[] = order.map(dow => ({
    day_of_week: dow,
    day_label: DAY_LABELS[dow],
    completion_rate: byDow[dow].scheduled > 0 ? byDow[dow].completed / byDow[dow].scheduled : 0,
    scheduled_hours_avg: byDow[dow].daysSeen.size > 0
      ? byDow[dow].scheduled / 60 / byDow[dow].daysSeen.size
      : 0,
    sample_size: byDow[dow].samples,
  }));

  if (confidence === 'none') {
    return { stats, weak_days: [], strong_days: [], confidence: 'none', sample_size };
  }

  const overall = stats
    .filter(s => s.sample_size >= 2)
    .reduce((acc, s) => acc + s.completion_rate, 0) / Math.max(1, stats.filter(s => s.sample_size >= 2).length);

  // Weak: ≥10pp below overall AND ≥3 samples in this DOW
  const weak_days = stats
    .filter(s => s.sample_size >= 3 && s.completion_rate < overall - 0.1)
    .map(s => s.day_of_week);

  // Strong: ≥10pp above overall AND ≥3 samples
  const strong_days = stats
    .filter(s => s.sample_size >= 3 && s.completion_rate > overall + 0.1)
    .map(s => s.day_of_week);

  return { stats, weak_days, strong_days, confidence, sample_size };
}

// ─────────────────────────────────────────────────────────────────────────
//  4. detectRecurringMisses
// ─────────────────────────────────────────────────────────────────────────

/**
 * Find recurring tasks the user keeps skipping. Pattern detection over the
 * last LOOKBACK_DAYS (default 28). Suggestion is intentionally generic
 * because the right fix depends on the task — different slot, lower
 * priority, smaller chunks, etc. The user decides.
 */
const LOOKBACK_DAYS = 28;
const MIN_ATTEMPTS = 4;
const MISS_RATE_THRESHOLD = 0.5;

export function detectRecurringMisses(
  events: CompletionEvent[],
  tasks: Task[]
): MissedPattern[] {
  const now = Date.now();
  const cutoff = now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const recurringTaskIds = new Set(tasks.filter(t => t.is_recurring && t.status === 'active').map(t => t.id));

  // Per-task: count attempts + misses + hour distribution
  const byTask = new Map<string, { task_title: string; attempts: number; misses: number; hours: Map<number, number> }>();
  for (const e of events) {
    if (new Date(e.scheduled_start).getTime() < cutoff) continue;
    if (!recurringTaskIds.has(e.task_id)) continue;
    const cur = byTask.get(e.task_id) ?? { task_title: e.task_title, attempts: 0, misses: 0, hours: new Map() };
    cur.attempts += 1;
    if (e.status === 'skipped') cur.misses += 1;
    cur.hours.set(e.hour_of_day, (cur.hours.get(e.hour_of_day) ?? 0) + 1);
    byTask.set(e.task_id, cur);
  }

  const out: MissedPattern[] = [];
  for (const [task_id, agg] of byTask) {
    if (agg.attempts < MIN_ATTEMPTS) continue;
    const miss_rate = agg.misses / agg.attempts;
    if (miss_rate < MISS_RATE_THRESHOLD) continue;

    // Most common hour
    let common: number | null = null;
    let max = 0;
    for (const [h, c] of agg.hours) {
      if (c > max) { max = c; common = h; }
    }

    const suggestion = common !== null
      ? `Skipped ${agg.misses} of ${agg.attempts} times — usually around ${formatHour(common)}. Try a different slot or lower the priority.`
      : `Skipped ${agg.misses} of ${agg.attempts} times. Consider a different slot or lower priority.`;

    out.push({
      task_id,
      task_title: agg.task_title,
      missed_count: agg.misses,
      total_attempts: agg.attempts,
      miss_rate,
      most_common_hour: common,
      suggestion,
    });
  }

  // Sort by miss count desc — biggest pain points first
  return out.sort((a, b) => b.missed_count - a.missed_count);
}

// ─────────────────────────────────────────────────────────────────────────
//  5. buildWeeklyDigest
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cumulative summary of the last N=7 days. The numbers are real — the
 * narrative ("headline") is built from them deterministically, never
 * generated. Surfaces in the WeeklyRetrospectiveSheet.
 */
export function buildWeeklyDigest(
  events: CompletionEvent[],
  tasks: Task[],
  daysBack = 7
): WeeklyDigest {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack + 1);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();

  const window = events.filter(e => new Date(e.scheduled_start).getTime() >= startMs);

  let scheduled_minutes = 0;
  let completed_minutes = 0;
  let skipped_minutes = 0;
  for (const e of window) {
    scheduled_minutes += e.scheduled_minutes;
    if (isDone(e)) completed_minutes += e.actual_minutes ?? e.scheduled_minutes;
    else if (e.status === 'skipped') skipped_minutes += e.scheduled_minutes;
  }
  const completion_rate = scheduled_minutes > 0 ? completed_minutes / scheduled_minutes : 0;

  // Best/worst day
  const dayShape = learnDayShape(window);
  const sortedDays = dayShape.stats.filter(s => s.sample_size > 0).sort((a, b) => b.completion_rate - a.completion_rate);
  const best_day = sortedDays.length > 0 ? { day_of_week: sortedDays[0].day_of_week, rate: sortedDays[0].completion_rate } : null;
  const worst_day = sortedDays.length > 1 ? { day_of_week: sortedDays[sortedDays.length - 1].day_of_week, rate: sortedDays[sortedDays.length - 1].completion_rate } : null;

  // Worst-overrun + best-estimate task aggregates
  type Agg = { title: string; ratios: number[] };
  const taskAgg = new Map<string, Agg>();
  for (const e of window) {
    if (e.status !== 'done') continue;
    if (!e.actual_minutes || e.scheduled_minutes <= 0) continue;
    const ratio = e.actual_minutes / e.scheduled_minutes;
    const a = taskAgg.get(e.task_id) ?? { title: e.task_title, ratios: [] };
    a.ratios.push(ratio);
    taskAgg.set(e.task_id, a);
  }

  const tasksWithStats = Array.from(taskAgg.values())
    .filter(a => a.ratios.length >= 2)
    .map(a => ({
      task_title: a.title,
      mean_ratio: a.ratios.reduce((s, r) => s + r, 0) / a.ratios.length,
      samples: a.ratios.length,
    }));

  const worst_overruns = tasksWithStats
    .filter(t => t.mean_ratio > 1.15)
    .sort((a, b) => b.mean_ratio - a.mean_ratio)
    .slice(0, 3)
    .map(t => ({
      task_title: t.task_title,
      overrun_pct: Math.round((t.mean_ratio - 1) * 100),
      samples: t.samples,
    }));

  const best_estimates = tasksWithStats
    .filter(t => Math.abs(t.mean_ratio - 1) <= 0.1)
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 3)
    .map(t => ({ task_title: t.task_title, samples: t.samples }));

  const headline = buildHeadline({ scheduled_minutes, completed_minutes, completion_rate, worst_overruns, best_day, dayShape });

  return {
    start_date: isoDate(start),
    end_date: isoDate(now),
    scheduled_minutes,
    completed_minutes,
    skipped_minutes,
    completion_rate,
    best_day,
    worst_day,
    worst_overruns,
    best_estimates,
    headline,
  };
}

function buildHeadline(arg: {
  scheduled_minutes: number;
  completed_minutes: number;
  completion_rate: number;
  worst_overruns: WeeklyDigest['worst_overruns'];
  best_day: WeeklyDigest['best_day'];
  dayShape: DayShape;
}): string {
  if (arg.scheduled_minutes === 0) return 'No scheduled work this week — nothing to retrospect on yet.';
  const pct = Math.round(arg.completion_rate * 100);
  const hours = (arg.completed_minutes / 60).toFixed(1);

  const parts: string[] = [];
  parts.push(`You finished ${hours}h (${pct}% of scheduled) this week.`);
  if (arg.best_day) {
    parts.push(`${DAY_LABELS[arg.best_day.day_of_week]} was your strongest at ${Math.round(arg.best_day.rate * 100)}%.`);
  }
  if (arg.worst_overruns.length > 0) {
    const top = arg.worst_overruns[0];
    parts.push(`${top.task_title} ran ${top.overrun_pct}% long across ${top.samples} sessions.`);
  }
  return parts.join(' ');
}

/** Helper for hooks: build a CompletionEvent from a block + task at write time. */
export function buildCompletionEvent(
  args: {
    block_id: string;
    task: Task;
    scheduled_start: string;
    scheduled_end: string;
    status: CompletionEvent['status'];
    actual_minutes?: number;
    confidence?: CompletionConfidence;
  }
): CompletionEvent {
  const start = new Date(args.scheduled_start);
  const end = new Date(args.scheduled_end);
  const scheduled_minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  // Skipped events are by definition explicit — the user told us. Done
  // events default to 'confirmed' if a confidence isn't supplied (back-compat).
  const confidence: CompletionConfidence =
    args.confidence ?? (args.status === 'skipped' ? 'confirmed' : 'confirmed');
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    task_id: args.task.id,
    task_title: args.task.title,
    scheduled_start: args.scheduled_start,
    scheduled_end: args.scheduled_end,
    scheduled_minutes,
    energy_intensity: args.task.energy_intensity,
    status: args.status,
    actual_minutes: args.actual_minutes,
    recorded_at: new Date().toISOString(),
    day_of_week: start.getDay(),
    hour_of_day: start.getHours(),
    confidence,
  };
}

/** Cap the log so it doesn't grow forever. */
export const MAX_COMPLETION_LOG = 500;

export function appendCompletion(
  log: CompletionEvent[],
  event: CompletionEvent
): CompletionEvent[] {
  return [event, ...log].slice(0, MAX_COMPLETION_LOG);
}

/** Read the current settings to feed each learning function. */
export function buildAllInsights(
  log: CompletionEvent[],
  tasks: Task[],
  settings: UserSettings
): {
  energy: EnergySuggestion;
  capacity: CapacitySuggestion;
  dayShape: DayShape;
  missed: MissedPattern[];
  digest: WeeklyDigest;
} {
  const deepStartHour = parseInt(settings.deep_window_start.split(':')[0], 10);
  const deepEndHour = parseInt(settings.deep_window_end.split(':')[0], 10);

  return {
    energy: learnEnergyCurve(log, deepStartHour, deepEndHour),
    capacity: learnCapacity(log, settings.max_total_hours_per_day),
    dayShape: learnDayShape(log),
    missed: detectRecurringMisses(log, tasks),
    digest: buildWeeklyDigest(log, tasks),
  };
}
