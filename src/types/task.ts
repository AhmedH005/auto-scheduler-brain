export type EnergyIntensity = 'deep' | 'moderate' | 'light';
export type SchedulingMode = 'flexible' | 'anchor' | 'fixed';
export type ExecutionStyle = 'single' | 'split' | 'auto_chunk';
export type RecurrencePattern = 'daily' | 'weekdays' | 'weekly' | 'custom';
export type BlockType = 'focus' | 'break';
export type TaskStatus = 'active' | 'completed' | 'paused';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  color?: string; // taskColors id, e.g. 'teal' | 'purple' | 'red' ...
  total_duration: number; // minutes
  priority: number; // 1-5
  deadline: string | null; // yyyy-MM-dd
  energy_intensity: EnergyIntensity;
  scheduling_mode: SchedulingMode;
  window_start: string | null; // HH:MM (used by anchor for preferred time)
  window_end: string | null; // HH:MM (used by anchor for preferred time)
  start_datetime: string | null; // yyyy-MM-ddTHH:mm (fixed tasks only)
  end_datetime: string | null; // yyyy-MM-ddTHH:mm (fixed tasks only)
  execution_style: ExecutionStyle;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  recurrence_interval: number;
  recurrence_end: string | null; // yyyy-MM-dd
  status: TaskStatus;
  created_at: string;
  /** Optional checklist of sub-items. Display-only for now — engine doesn't
   *  schedule sub-items individually. */
  subtasks?: Subtask[];
  /** Engine won't schedule the task before this date (yyyy-MM-dd). Useful
   *  for "wait for W-2 in Jan" / "follow up if no reply by Friday". */
  snooze_until?: string | null;
  /** Free-form tags / projects / areas for organization and filtering.
   *  Things 3 / Linear / Sunsama / Motion all use a tag-or-project
   *  abstraction; we keep it simple as a string array (single-user, no
   *  hierarchy) — users set their own conventions. */
  tags?: string[];
  // Present only on tasks synced from external calendar providers
  sync_source?: 'google' | 'microsoft';
  provider_event_id?: string;
  calendar_color?: string; // hex color from the provider calendar
}

export interface ScheduledBlock {
  id: string;
  task_id: string;
  start_time: string; // local datetime yyyy-MM-ddTHH:mm:ss
  end_time: string; // local datetime yyyy-MM-ddTHH:mm:ss
  locked: boolean;
  block_type: BlockType;
  instance_date: string; // yyyy-MM-dd for recurring tracking
  /** Set when the user marks the block as done. Engine treats completed
   *  blocks as preserved (no reschedule) and uses actual_minutes to compute
   *  consumed time for the parent task instance. */
  completed_at?: string;
  /** Actual minutes the user reported spending. When omitted, the engine
   *  falls back to the scheduled duration (end - start). */
  actual_minutes?: number;
  /** How we know this block was completed. The learning engine weights
   *  events by this so passive inference doesn't override explicit signal:
   *    confirmed       — user explicitly tapped Done (weight 1.0)
   *    inferred-active — block ended AND user was active in AXIS during it (0.8)
   *    assumed         — block end-time passed, user didn't skip (0.5)
   *  Undefined means the block isn't completed yet (still pending). */
  completion_confidence?: CompletionConfidence;
  /** When auto-mark assumes a block done, we accumulate "AXIS-tab visible
   *  minutes" during the block window. The user can audit this. */
  visible_minutes?: number;
}

export type CompletionConfidence = 'confirmed' | 'inferred-active' | 'assumed';

export interface UserSettings {
  working_hours_start: string; // HH:MM
  working_hours_end: string; // HH:MM
  deep_window_start: string; // HH:MM
  deep_window_end: string; // HH:MM
  buffer_time: number; // minutes
  max_deep_hours_per_day: number;
  max_total_hours_per_day: number;
  min_chunk_size: number; // minutes
  max_chunk_size: number; // minutes
}

/** Per-day overrides. Lets a user say "today is an easy day, cap me at 4h"
 *  without permanently changing their default cap. Keys are yyyy-MM-dd. */
export interface DailyOverride {
  max_total_hours?: number;
  max_deep_hours?: number;
  /** Friendly label shown in the UI. */
  label?: 'easy' | 'normal' | 'heavy';
}

export type DailyOverrides = Record<string, DailyOverride>;

export interface TaskInstance {
  task: Task;
  instance_date: string; // yyyy-MM-dd
  remaining_duration: number; // minutes
}

export const DEFAULT_SETTINGS: UserSettings = {
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  deep_window_start: '08:00',
  deep_window_end: '12:00',
  buffer_time: 10,
  max_deep_hours_per_day: 4,
  max_total_hours_per_day: 8,
  min_chunk_size: 25,
  max_chunk_size: 120,
};

// ─────────────────────────────────────────────────────────────────────────
//  Rebuild result + diff types — engine v2
// ─────────────────────────────────────────────────────────────────────────

export type DropReason =
  | 'no-fit-before-deadline'
  | 'over-daily-cap'
  | 'no-working-hours-remaining'
  | 'partial-placement'
  | 'unknown';

export interface DroppedTask {
  task_id: string;
  task_title: string;
  reason: DropReason;
  remaining_minutes: number; // how much we couldn't place
  deadline: string | null;
  instance_date?: string; // for recurring tasks
}

export type AtRiskReason =
  | 'lands-on-deadline-day'
  | 'lands-day-before-deadline'
  | 'split-spans-deadline'
  | 'one-shot-at-zero-buffer';

export interface AtRiskTask {
  task_id: string;
  task_title: string;
  reason: AtRiskReason;
  deadline: string;
  scheduled_finish: string; // yyyy-MM-ddTHH:mm
  buffer_minutes: number; // negative if past deadline
}

export interface RebuildResult {
  blocks: ScheduledBlock[];
  dropped: DroppedTask[];
  at_risk: AtRiskTask[];
  /** Wall-clock time the rebuild was computed (ISO). */
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
//  Schedule diffing (preview-before-apply)
// ─────────────────────────────────────────────────────────────────────────

export interface BlockMove {
  block_id: string;
  task_id: string;
  task_title: string;
  before: { start_time: string; end_time: string };
  after: { start_time: string; end_time: string };
}

export interface ScheduleDiff {
  added: ScheduledBlock[];
  moved: BlockMove[];
  removed: ScheduledBlock[];
  unchanged_count: number;
  /** Plain-English reasons keyed by block_id or task_id. */
  reasons: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────
//  Adaptive duration learning
// ─────────────────────────────────────────────────────────────────────────

export interface DurationLog {
  id: string; // unique log id
  task_id: string;
  task_title: string;
  estimated_minutes: number;
  actual_minutes: number;
  energy_intensity: EnergyIntensity;
  completed_at: string; // ISO
}

export interface DurationSuggestion {
  estimated_minutes: number; // what the user / task says
  suggested_minutes: number; // what history says is realistic
  delta_pct: number; // (suggested - estimated) / estimated * 100
  confidence: 'high' | 'medium' | 'low' | 'none';
  sample_size: number;
  source: 'task-specific' | 'energy-cohort' | 'fallback';
}

// ─────────────────────────────────────────────────────────────────────────
//  Undo stack snapshot
// ─────────────────────────────────────────────────────────────────────────

export interface RescheduleSnapshot {
  blocks: ScheduledBlock[];
  taken_at: string; // ISO
  label: string; // e.g. "Before rebuild at 14:32" or "Before moving 'Thesis ch.3'"
}

// ─────────────────────────────────────────────────────────────────────────
//  Learning layer — observations the system uses to model THIS user
// ─────────────────────────────────────────────────────────────────────────

export type CompletionStatus = 'done' | 'skipped' | 'partial';

/** One observation per completed / skipped / partially-completed block.
 *  Day-of-week and hour-of-day are extracted at write time so that the
 *  inference functions don't have to re-parse dates on every read.
 *
 *  This is the user's behavioral history — the input to every learning
 *  function in src/engine/learning.ts. */
export interface CompletionEvent {
  id: string;
  task_id: string;
  task_title: string;
  /** Scheduled time the block held — what the engine TRIED to give the user. */
  scheduled_start: string; // ISO
  scheduled_end: string;   // ISO
  scheduled_minutes: number;
  energy_intensity: EnergyIntensity;
  status: CompletionStatus;
  /** Minutes actually spent. Set for status='done' and 'partial'. Undefined for 'skipped'. */
  actual_minutes?: number;
  /** When the user marked the block — not when it was scheduled. */
  recorded_at: string; // ISO
  /** 0=Sunday ... 6=Saturday — extracted from scheduled_start. */
  day_of_week: number;
  /** 0..23 — extracted from scheduled_start. */
  hour_of_day: number;
  /** How we know this happened. Inference weights events by confidence. */
  confidence: CompletionConfidence;
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface EnergySuggestion {
  /** Currently configured deep window. */
  current_start_hour: number;
  current_end_hour: number;
  /** Suggested deep window inferred from completion history. */
  suggested_start_hour: number;
  suggested_end_hour: number;
  /** True when current ≠ suggested AND confidence > 'low'. */
  shift_recommended: boolean;
  confidence: Confidence;
  /** How many deep completions informed this. */
  sample_size: number;
  /** Plain-English summary like "You complete deep work most reliably 9–11am." */
  reason: string;
}

export interface CapacitySuggestion {
  current_cap_hours: number;
  /** What the data says is realistic. */
  suggested_cap_hours: number;
  /** Mean completion rate at the current cap. */
  completion_rate_at_current: number;
  /** Mean completion rate at the suggested cap. */
  completion_rate_at_suggested: number;
  reduce_recommended: boolean;
  raise_recommended: boolean;
  confidence: Confidence;
  sample_size: number;
  reason: string;
}

export interface DayShapeStat {
  day_of_week: number; // 0..6
  day_label: string; // "Mon", "Tue", ...
  completion_rate: number; // 0..1
  scheduled_hours_avg: number;
  sample_size: number;
}

export interface DayShape {
  /** Per-DOW completion stats, ordered Mon..Sun for ergonomic display. */
  stats: DayShapeStat[];
  /** DOW indices where completion is meaningfully below average. */
  weak_days: number[];
  /** DOW indices where completion is meaningfully above average. */
  strong_days: number[];
  confidence: Confidence;
  sample_size: number;
}

export interface MissedPattern {
  task_id: string;
  task_title: string;
  missed_count: number;
  total_attempts: number;
  miss_rate: number; // 0..1
  /** The hour-of-day this task is most often scheduled at, if there's a pattern. */
  most_common_hour: number | null;
  /** Suggested action — usually "try a different slot" or "lower priority". */
  suggestion: string;
}

export interface WeeklyDigest {
  /** Window the digest covers, ISO dates inclusive. */
  start_date: string;
  end_date: string;
  scheduled_minutes: number;
  completed_minutes: number;
  skipped_minutes: number;
  completion_rate: number; // completed / scheduled
  best_day: { day_of_week: number; rate: number } | null;
  worst_day: { day_of_week: number; rate: number } | null;
  /** Top 3 tasks by overrun (actual > estimated). */
  worst_overruns: Array<{ task_title: string; overrun_pct: number; samples: number }>;
  /** Top 3 tasks completing on-budget — positive reinforcement. */
  best_estimates: Array<{ task_title: string; samples: number }>;
  /** Sentence-style summary for the user. */
  headline: string;
}
