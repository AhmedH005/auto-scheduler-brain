export type EnergyIntensity = 'deep' | 'moderate' | 'light';
export type SchedulingMode = 'flexible' | 'anchor' | 'fixed';
export type ExecutionStyle = 'single' | 'split' | 'auto_chunk';
export type RecurrencePattern = 'daily' | 'weekdays' | 'weekly' | 'custom';
export type BlockType = 'focus' | 'break';
export type TaskStatus = 'active' | 'completed' | 'paused';

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
}

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
