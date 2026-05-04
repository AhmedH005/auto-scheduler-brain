/**
 * TaskForm — property-row editor for tasks.
 *
 * Pattern lineage (every choice is borrowed, not invented):
 *   • Title + description: Things 3 — borderless inputs, autofocus on title,
 *     no visible label until something's typed.
 *   • Property rows (icon + label on left, control on right): Linear /
 *     Notion / GitHub Issues — uniform vertical rhythm, no big chunky cards.
 *   • Segmented controls for 2-5 enums (Mode, Energy): iOS / Linear —
 *     beats a dropdown when n ≤ 5 and labels are short.
 *   • Pill priority 1-5: Linear — discrete steps, color-encoded, more
 *     scannable than a slider.
 *   • Inline progressive disclosure for Recurring: Notion — toggle reveals
 *     pattern + end-date inline rather than nesting in a side card.
 *   • Sticky footer button: every modern sheet (Cron, Notion, Linear).
 *
 * What got cut from the previous version:
 *   - Duplicate inner header ("EDIT TASK" with pencil + close).
 *   - Big 3-card mode picker (now a 3-segment pill).
 *   - 7 duration chiclets (now a small dropdown with a custom-min input).
 *   - "BELOW AVG" giant text next to slider (priority is now visible pills).
 *   - Recurring-as-indented-box (now inline progressive reveal).
 */

import React, { useMemo, useState } from 'react';
import {
  Task,
  EnergyIntensity,
  SchedulingMode,
  ExecutionStyle,
  RecurrencePattern,
  DurationSuggestion,
  ScheduledBlock,
} from '@/types/task';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Zap,
  Repeat,
  Shield,
  Pin,
  Shuffle,
  AlertTriangle,
  Sparkles,
  Flame,
  Palette,
  Layers,
} from 'lucide-react';
import { TASK_COLORS, DEFAULT_COLOR_ID } from '@/lib/taskColors';
import { useTranslation } from 'react-i18next';

interface TaskFormProps {
  onSubmit: (task: Task) => void;
  onClose: () => void;
  initialTask?: Partial<Task>;
  existingBlocks?: ScheduledBlock[];
  existingTasks?: Task[];
  quickAddDate?: string;
  quickAddTime?: string;
  getDurationSuggestion?: (
    task: Pick<Task, 'id' | 'title' | 'total_duration' | 'energy_intensity'>
  ) => DurationSuggestion;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(t: string, add: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = Math.min(h * 60 + m + add, 22 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function checkOverlap(
  date: string,
  startTime: string,
  endTime: string,
  existingBlocks: ScheduledBlock[],
  existingTasks: Task[],
  excludeTaskId?: string
): string | null {
  if (!date || !startTime || !endTime) return null;
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  if (newStart >= newEnd) return null;
  const taskMap = new Map(existingTasks.map(t => [t.id, t]));
  for (const block of existingBlocks) {
    if (excludeTaskId && block.task_id === excludeTaskId) continue;
    const bStart = new Date(block.start_time);
    const bDate = `${bStart.getFullYear()}-${String(bStart.getMonth() + 1).padStart(2, '0')}-${String(bStart.getDate()).padStart(2, '0')}`;
    if (bDate !== date) continue;
    const bStartMin = bStart.getHours() * 60 + bStart.getMinutes();
    const bEnd = new Date(block.end_time);
    const bEndMin = bEnd.getHours() * 60 + bEnd.getMinutes();
    if (newStart < bEndMin && newEnd > bStartMin) {
      const task = taskMap.get(block.task_id);
      const label = task?.title || 'another block';
      const from = `${String(Math.floor(bStartMin / 60)).padStart(2, '0')}:${String(bStartMin % 60).padStart(2, '0')}`;
      const to = `${String(Math.floor(bEndMin / 60)).padStart(2, '0')}:${String(bEndMin % 60).padStart(2, '0')}`;
      return `Overlaps with "${label}" (${from}–${to})`;
    }
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function TaskForm({
  onSubmit,
  onClose,
  initialTask,
  existingBlocks = [],
  existingTasks = [],
  quickAddDate,
  quickAddTime,
  getDurationSuggestion,
}: TaskFormProps) {
  const { t } = useTranslation();

  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [color, setColor] = useState(initialTask?.color || DEFAULT_COLOR_ID);
  const [duration, setDuration] = useState(initialTask?.total_duration || 30);
  const [priority, setPriority] = useState(initialTask?.priority || 3);

  const [mode, setMode] = useState<SchedulingMode>(() => {
    if (quickAddDate && quickAddTime) return 'fixed';
    const m =
      initialTask?.scheduling_mode === ('windowed' as string)
        ? 'anchor'
        : initialTask?.scheduling_mode || 'flexible';
    return m as SchedulingMode;
  });

  const [deadline, setDeadline] = useState(initialTask?.deadline || '');
  const [energy, setEnergy] = useState<EnergyIntensity>(initialTask?.energy_intensity || 'moderate');
  const [execStyle, setExecStyle] = useState<ExecutionStyle>(
    initialTask?.execution_style || 'auto_chunk'
  );
  const [isRecurring, setIsRecurring] = useState(initialTask?.is_recurring || false);
  const [recPattern, setRecPattern] = useState<RecurrencePattern>(
    initialTask?.recurrence_pattern || 'weekdays'
  );
  const [recInterval, setRecInterval] = useState(initialTask?.recurrence_interval || 1);
  const [recEnd, setRecEnd] = useState(initialTask?.recurrence_end || '');

  const [anchorStart, setAnchorStart] = useState(initialTask?.window_start || '');
  const [anchorEnd, setAnchorEnd] = useState(initialTask?.window_end || '');

  const [fixedDate, setFixedDate] = useState(() => {
    if (quickAddDate) return quickAddDate;
    if (initialTask?.start_datetime) return initialTask.start_datetime.substring(0, 10);
    return '';
  });
  const [fixedStartTime, setFixedStartTime] = useState(() => {
    if (quickAddTime) return quickAddTime;
    if (initialTask?.start_datetime) return initialTask.start_datetime.substring(11, 16);
    return '';
  });
  const [fixedEndTime, setFixedEndTime] = useState(() => {
    if (quickAddTime) return addMinutesToTime(quickAddTime, 60);
    if (initialTask?.end_datetime) return initialTask.end_datetime.substring(11, 16);
    return '';
  });

  const overlapWarning = (() => {
    if (mode === 'fixed' && fixedDate && fixedStartTime && fixedEndTime) {
      return checkOverlap(
        fixedDate,
        fixedStartTime,
        fixedEndTime,
        existingBlocks,
        existingTasks,
        initialTask?.id
      );
    }
    return null;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (overlapWarning) return;

    let startDatetime: string | null = null;
    let endDatetime: string | null = null;
    if (mode === 'fixed' && fixedDate && fixedStartTime && fixedEndTime) {
      startDatetime = `${fixedDate}T${fixedStartTime}:00`;
      endDatetime = `${fixedDate}T${fixedEndTime}:00`;
    }

    const task: Task = {
      id: initialTask?.id || crypto.randomUUID(),
      title: title.trim(),
      description: description.trim() || undefined,
      color,
      total_duration:
        mode === 'fixed'
          ? 0
          : mode === 'anchor' && anchorStart && anchorEnd
          ? timeToMinutes(anchorEnd) - timeToMinutes(anchorStart)
          : duration,
      priority,
      deadline: mode === 'flexible' ? (isRecurring ? recEnd || null : deadline || null) : null,
      energy_intensity: energy,
      scheduling_mode: mode,
      window_start: mode === 'anchor' ? anchorStart || null : null,
      window_end: mode === 'anchor' ? anchorEnd || null : null,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      execution_style: mode === 'fixed' || mode === 'anchor' ? 'single' : execStyle,
      is_recurring: mode === 'fixed' ? false : isRecurring,
      recurrence_pattern: isRecurring && mode !== 'fixed' ? recPattern : null,
      recurrence_interval: recInterval,
      recurrence_end: isRecurring && recEnd ? recEnd : null,
      status: 'active',
      created_at: initialTask?.created_at || new Date().toISOString(),
      ...(initialTask?.sync_source && { sync_source: initialTask.sync_source }),
      ...(initialTask?.provider_event_id && {
        provider_event_id: initialTask.provider_event_id,
      }),
      ...(initialTask?.calendar_color && { calendar_color: initialTask.calendar_color }),
    };
    onSubmit(task);
  };

  const isEditing = !!initialTask?.id;

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          handleSubmit(e as unknown as React.FormEvent);
        }
      }}
      className="flex flex-col h-full"
    >
      {/* Scrollable body — title + description as the hero, properties below */}
      <div className="flex-1 overflow-y-auto">
        {/* Title — borderless hero input (Things 3 / Linear pattern) */}
        <div className="px-5 pt-4 pb-1">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
            className="w-full bg-transparent text-display text-foreground placeholder:text-muted-foreground/40 focus:outline-none border-0 p-0 leading-tight"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add a description…"
            rows={1}
            className="mt-1.5 w-full bg-transparent text-body text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none border-0 p-0 resize-none leading-relaxed"
            style={{ minHeight: 22 }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
            }}
          />
        </div>

        <Divider />

        {/* Property rows — Linear/Notion pattern */}
        <div className="px-3 py-1.5">
          <PropertyRow icon={Layers} label="Mode">
            <Segmented
              value={mode}
              onChange={v => setMode(v as SchedulingMode)}
              options={[
                { value: 'flexible', label: 'Flexible', icon: Shuffle },
                { value: 'anchor', label: 'Anchor', icon: Shield },
                { value: 'fixed', label: 'Fixed', icon: Pin },
              ]}
            />
          </PropertyRow>

          {/* Mode-specific timing */}
          {mode === 'flexible' && (
            <PropertyRow icon={Clock} label="Duration">
              <DurationControl value={duration} onChange={setDuration} />
            </PropertyRow>
          )}

          {mode === 'anchor' && (
            <PropertyRow icon={Clock} label="Window">
              <div className="flex items-center gap-1.5 w-full justify-end">
                <Input
                  type="time"
                  value={anchorStart}
                  onChange={e => setAnchorStart(e.target.value)}
                  className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-24"
                />
                <span className="text-[10px] text-muted-foreground/60">to</span>
                <Input
                  type="time"
                  value={anchorEnd}
                  onChange={e => setAnchorEnd(e.target.value)}
                  className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-24"
                />
              </div>
            </PropertyRow>
          )}

          {mode === 'fixed' && (
            <>
              <PropertyRow icon={Calendar} label="Date">
                <Input
                  type="date"
                  value={fixedDate}
                  onChange={e => setFixedDate(e.target.value)}
                  className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto"
                />
              </PropertyRow>
              <PropertyRow icon={Clock} label="Time">
                <div className="flex items-center gap-1.5 w-full justify-end">
                  <Input
                    type="time"
                    value={fixedStartTime}
                    onChange={e => setFixedStartTime(e.target.value)}
                    className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-24"
                  />
                  <span className="text-[10px] text-muted-foreground/60">to</span>
                  <Input
                    type="time"
                    value={fixedEndTime}
                    onChange={e => setFixedEndTime(e.target.value)}
                    className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-24"
                  />
                </div>
              </PropertyRow>
            </>
          )}

          <PropertyRow icon={Flame} label="Priority">
            <PriorityPills value={priority} onChange={setPriority} />
          </PropertyRow>

          <PropertyRow icon={Zap} label="Energy">
            <Segmented
              value={energy}
              onChange={v => setEnergy(v as EnergyIntensity)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'deep', label: 'Deep' },
              ]}
            />
          </PropertyRow>

          {mode === 'flexible' && (
            <PropertyRow icon={Sparkles} label="Execution">
              <Select value={execStyle} onValueChange={v => setExecStyle(v as ExecutionStyle)}>
                <SelectTrigger className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single block</SelectItem>
                  <SelectItem value="split">Split across days</SelectItem>
                  <SelectItem value="auto_chunk">Auto-chunk</SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>
          )}

          {mode !== 'fixed' && !isRecurring && (
            <PropertyRow icon={Calendar} label="Deadline">
              <Input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto"
              />
            </PropertyRow>
          )}

          {mode !== 'fixed' && (
            <>
              <PropertyRow icon={Repeat} label="Repeat">
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={
                    'inline-flex items-center justify-center px-3 h-7 rounded-md text-[11px] font-medium transition-colors ml-auto ' +
                    (isRecurring
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-secondary/40 text-muted-foreground border border-border hover:bg-secondary/60')
                  }
                >
                  {isRecurring ? 'On' : 'Off'}
                </button>
              </PropertyRow>

              {isRecurring && (
                <>
                  <PropertyRow icon={Repeat} label="Pattern" sub>
                    <Select
                      value={recPattern}
                      onValueChange={v => setRecPattern(v as RecurrencePattern)}
                    >
                      <SelectTrigger className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Every day</SelectItem>
                        <SelectItem value="weekdays">Weekdays</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="custom">Custom interval</SelectItem>
                      </SelectContent>
                    </Select>
                  </PropertyRow>
                  {recPattern === 'custom' && (
                    <PropertyRow icon={Repeat} label="Every" sub>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Input
                          type="number"
                          value={recInterval}
                          onChange={e =>
                            setRecInterval(Math.max(1, Number(e.target.value)))
                          }
                          min={1}
                          className="w-16 bg-secondary/50 border-border font-mono text-[11px] h-7 text-center"
                        />
                        <span className="text-[10px] text-muted-foreground/65">days</span>
                      </div>
                    </PropertyRow>
                  )}
                  <PropertyRow icon={Calendar} label="Until" sub>
                    <Input
                      type="date"
                      value={recEnd}
                      onChange={e => setRecEnd(e.target.value)}
                      className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto"
                    />
                  </PropertyRow>
                </>
              )}
            </>
          )}

          <PropertyRow icon={Palette} label="Color">
            <div className="flex items-center gap-1 flex-wrap justify-end ml-auto">
              {TASK_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.id)}
                  className={
                    'w-4 h-4 rounded-full transition-all ' +
                    (color === c.id
                      ? 'ring-2 ring-offset-2 ring-offset-card ring-foreground/70 scale-110'
                      : 'opacity-70 hover:opacity-100 hover:scale-110')
                  }
                  style={{ backgroundColor: c.border }}
                />
              ))}
            </div>
          </PropertyRow>

          {mode === 'flexible' && (
            <DurationHint
              taskId={initialTask?.id}
              title={title}
              duration={duration}
              energy={energy}
              onApply={setDuration}
              getDurationSuggestion={getDurationSuggestion}
            />
          )}

          {overlapWarning && (
            <div className="mx-2 my-2 flex items-start gap-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{overlapWarning}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer with primary action — Cron / Linear / Notion pattern */}
      <div className="shrink-0 px-5 py-3 border-t border-border bg-card/95 backdrop-blur flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 h-9 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          Cancel
        </button>
        <div className="flex-1" />
        <kbd className="hidden sm:inline-flex text-[9px] font-mono text-muted-foreground/55 px-1.5 py-0.5 rounded border border-border bg-secondary/40">
          ⌘ ↵
        </kbd>
        <button
          type="submit"
          disabled={!title.trim() || !!overlapWarning}
          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          {isEditing ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-border/60" />;
}

function PropertyRow({
  icon: Icon,
  label,
  children,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  /** Renders as a sub-row indented and quieter — used for nested fields
   *  inside a parent like Recurring. */
  sub?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-3 py-1.5 ' + (sub ? 'pl-8' : 'px-2')
      }
    >
      <div
        className={
          'flex items-center gap-2 shrink-0 ' +
          (sub
            ? 'w-[88px] text-muted-foreground/55'
            : 'w-[100px] text-muted-foreground/75')
        }
      >
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex-1 min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-md bg-secondary/40 border border-border ml-auto">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              'inline-flex items-center gap-1 px-2.5 h-6 rounded-sm text-[11px] font-medium transition-all ' +
              (active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {opt.icon && <opt.icon className="w-2.5 h-2.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PriorityPills({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 ml-auto">
      {[1, 2, 3, 4, 5].map(p => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            title={priorityName(p)}
            className={
              'w-7 h-7 rounded-md text-[11px] font-mono font-semibold tabular-nums transition-all ' +
              (active
                ? p >= 5
                  ? 'bg-destructive text-white shadow-sm scale-105'
                  : p === 4
                  ? 'bg-amber-500/85 text-white shadow-sm scale-105'
                  : p === 3
                  ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                  : 'bg-muted text-foreground shadow-sm scale-105'
                : 'bg-secondary/40 text-muted-foreground/70 hover:bg-secondary/70 hover:text-foreground')
            }
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

function priorityName(p: number): string {
  if (p >= 5) return 'Urgent';
  if (p === 4) return 'High';
  if (p === 3) return 'Medium';
  if (p === 2) return 'Low';
  return 'Minimal';
}

function DurationControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const presets = [15, 30, 45, 60, 90, 120];
  const isPreset = presets.includes(value);
  return (
    <div className="inline-flex items-center gap-1.5 ml-auto">
      <Select
        value={isPreset ? String(value) : 'custom'}
        onValueChange={v => {
          if (v === 'custom') return;
          onChange(parseInt(v, 10));
        }}
      >
        <SelectTrigger className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map(p => (
            <SelectItem key={p} value={String(p)}>
              {p} min
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom…</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        min={5}
        max={480}
        step={5}
        value={value}
        onChange={e => onChange(Math.max(5, Number(e.target.value)))}
        className="w-16 text-center font-mono text-[11px] bg-secondary/50 border-border h-7"
      />
      <span className="text-[10px] text-muted-foreground/65">min</span>
    </div>
  );
}

// ─── Adaptive duration hint (carried over from previous version) ──────

function DurationHint({
  taskId,
  title,
  duration,
  energy,
  onApply,
  getDurationSuggestion,
}: {
  taskId: string | undefined;
  title: string;
  duration: number;
  energy: EnergyIntensity;
  onApply: (next: number) => void;
  getDurationSuggestion?: (
    task: Pick<Task, 'id' | 'title' | 'total_duration' | 'energy_intensity'>
  ) => DurationSuggestion;
}) {
  const suggestion = useMemo(() => {
    if (!getDurationSuggestion) return null;
    if (!title || title.trim().length < 3) return null;
    return getDurationSuggestion({
      id: taskId ?? 'pending',
      title,
      total_duration: duration,
      energy_intensity: energy,
    });
  }, [getDurationSuggestion, taskId, title, duration, energy]);

  if (!suggestion) return null;
  if (suggestion.confidence === 'none') return null;
  if (Math.abs(suggestion.delta_pct) < 10) return null;
  if (suggestion.suggested_minutes === duration) return null;

  const direction = suggestion.delta_pct > 0 ? 'longer' : 'shorter';
  const confidenceCopy = {
    high: `${suggestion.sample_size} past completions`,
    medium: `${suggestion.sample_size} similar tasks`,
    low: 'recent pattern',
  } as const;

  return (
    <button
      type="button"
      onClick={() => onApply(suggestion.suggested_minutes)}
      className="mx-2 mt-2 w-[calc(100%-1rem)] flex items-start gap-2 px-3 py-2 rounded-md bg-primary/8 border border-primary/20 hover:bg-primary/12 transition-colors text-left"
    >
      <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-primary leading-tight">
          History suggests {suggestion.suggested_minutes}m ({Math.abs(suggestion.delta_pct)}%{' '}
          {direction})
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Based on {confidenceCopy[suggestion.confidence as 'high' | 'medium' | 'low']}. Click to
          apply.
        </p>
      </div>
    </button>
  );
}
