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
}

export interface ScheduledBlock {
  id: string;
  task_id: string;
  start_time: string; // local datetime yyyy-MM-ddTHH:mm:ss
  end_time: string; // local datetime yyyy-MM-ddTHH:mm:ss
  locked: boolean;
  block_type: BlockType;
  instance_date: string; // yyyy-MM-dd for recurring tracking
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

export interface TaskInstance {
  task: Task;
  instance_date: string; // yyyy-MM-dd
  remaining_duration: number; // minutes
}

// Internal tracking (no UI yet)
export interface TaskMetrics {
  task_id: string;
  completions: number;
  reschedules: number;
  total_scheduled_minutes: number;
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
