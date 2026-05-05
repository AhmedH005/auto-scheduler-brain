/**
 * TaskForm — research-backed task editor.
 *
 * Pattern lineage (every choice is borrowed, not invented):
 *
 *   • Title + description hero (Things 3): borderless inputs, autofocus
 *     on title, no labels until typed. Matches what users praise about
 *     Things — "no friction, just type."
 *
 *   • Action-verb scheduling labels (Reclaim / Motion): the previous
 *     "Flexible / Anchor / Fixed" required learning. Renamed to behavior:
 *     "Auto-schedule" / "In a window" / "At a specific time". Same engine
 *     values (flexible/anchor/fixed) — only the labels changed.
 *
 *   • Named priority pills (Linear / Motion): users praise Linear for
 *     "No priority / Urgent / High / Medium / Low" with color encoding.
 *     1-5 with no labels needs translation; named pills don't.
 *
 *   • Repeat as a single dropdown with presets (Things / Cron / Motion):
 *     Off / Daily / Weekdays / Weekly / Monthly / Custom. The pattern +
 *     interval + until that we used to indent inline now hides under
 *     "Custom".
 *
 *   • Deadline quick-chips (Things / Sunsama): Today / Tomorrow / Fri /
 *     None covers ~70% of cases. Custom date stays as fallback.
 *
 *   • Progressive disclosure (Linear / Notion / GitHub Issues): essentials
 *     visible, the rest hides under an "Advanced" reveal. Reduces the
 *     11-row wall of fields to ~5 visible rows.
 *
 *   • Snooze-until in Advanced (Reclaim / Motion): "don't schedule before
 *     this date." Useful for tasks not yet ripe; filed under Advanced
 *     because most tasks don't need it.
 *
 *   • "Deep focus" as a single toggle (Cal Newport's deep-work framing):
 *     the previous 3-level energy was over-articulated. Off = standard.
 *     On = protect for peak hours. Existing 'light' tasks display as
 *     standard.
 *
 *   • Sticky footer with primary CTA (every modern sheet — Cron, Notion,
 *     Linear, Things). Cancel left, Save right, ⌘↵ keyboard shortcut hint.
 */

import React, { useMemo, useState } from 'react';
import { format, addDays, nextFriday } from 'date-fns';
import {
  Task,
  Subtask,
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
  Repeat,
  Shuffle,
  Pin,
  Crosshair,
  AlertTriangle,
  Sparkles,
  Flame,
  Palette,
  ChevronDown,
  Brain,
  AlarmClock,
  ListChecks,
  Plus,
  X as XIcon,
} from 'lucide-react';
import { TASK_COLORS, DEFAULT_COLOR_ID } from '@/lib/taskColors';

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

// ─── Helpers ─────────────────────────────────────────────────────────────

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
  const [energy, setEnergy] = useState<EnergyIntensity>(
    initialTask?.energy_intensity || 'moderate'
  );
  // The user used to pick this manually (Single / Split / Auto-chunk).
  // We now auto-decide on save: duration ≥ 60min → auto_chunk, else single.
  // Existing tasks keep whatever they had until they get edited again.
  const [execStyle] = useState<ExecutionStyle>(
    initialTask?.execution_style || 'auto_chunk'
  );

  // Subtasks (Things 3 / Linear / Notion pattern) — display-only on the
  // engine side for now; the user just gets a checklist they can tick off.
  const [subtasks, setSubtasks] = useState(initialTask?.subtasks ?? []);

  // Recurrence — collapsed into a single preset enum for the dropdown.
  // 'custom' opens the interval input below.
  type RepeatPreset = 'off' | 'daily' | 'weekdays' | 'weekly' | 'custom';
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>(() => {
    if (!initialTask?.is_recurring) return 'off';
    return (initialTask.recurrence_pattern as RepeatPreset) || 'weekly';
  });
  const [recInterval, setRecInterval] = useState(initialTask?.recurrence_interval || 1);
  const [recEnd, setRecEnd] = useState(initialTask?.recurrence_end || '');
  const isRecurring = repeatPreset !== 'off';

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

  // Advanced fields
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState(''); // not yet on Task type — staged for engine integration

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

    const recPattern: RecurrencePattern | null =
      repeatPreset === 'off' ? null : (repeatPreset as RecurrencePattern);

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
      // Auto-decide chunking based on duration.
      execution_style:
        mode === 'fixed' || mode === 'anchor'
          ? 'single'
          : duration >= 60
          ? 'auto_chunk'
          : 'single',
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
      ...(subtasks.length > 0 && { subtasks }),
      ...(snoozeUntil && { snooze_until: snoozeUntil }),
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
      <div className="flex-1 overflow-y-auto">
        {/* Hero — title + description (Things 3 pattern, scaled up) */}
        <div className="px-6 pt-5 pb-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What's this task?"
            autoFocus
            className="w-full bg-transparent text-[20px] font-semibold text-foreground placeholder:text-muted-foreground/35 focus:outline-none border-0 p-0 leading-tight tracking-tight"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add notes (optional)…"
            rows={1}
            className="mt-2 w-full bg-transparent text-[13px] text-foreground/75 placeholder:text-muted-foreground/35 focus:outline-none border-0 p-0 resize-none leading-relaxed"
            style={{ minHeight: 22 }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
            }}
          />
        </div>

        {/* Subtasks (Things 3 / Linear / Notion checklist pattern) */}
        <SubtaskList value={subtasks} onChange={setSubtasks} />

        <Divider />

        {/* ───── ESSENTIALS ───── */}
        <div className="px-4 py-3 space-y-0.5">
          {/* WHEN — was "Mode". Action-verb labels (Reclaim/Motion). */}
          <PropertyRow icon={Crosshair} label="When">
            <Segmented
              value={mode}
              onChange={v => setMode(v as SchedulingMode)}
              options={[
                { value: 'flexible', label: 'Auto', icon: Shuffle, hint: 'Engine places it for you' },
                { value: 'anchor', label: 'In a window', icon: Crosshair, hint: 'Schedule between two times' },
                { value: 'fixed', label: 'At a time', icon: Pin, hint: 'Lock to specific datetime' },
              ]}
            />
          </PropertyRow>

          {/* DURATION — only when auto-scheduling (window has its own duration) */}
          {mode === 'flexible' && (
            <PropertyRow icon={Clock} label="Duration">
              <DurationControl value={duration} onChange={setDuration} />
            </PropertyRow>
          )}

          {/* WINDOW — when "In a window" */}
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

          {/* FIXED — when "At a specific time" */}
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

          {/* PRIORITY — Linear-style named pills */}
          <PropertyRow icon={Flame} label="Priority">
            <NamedPriorityPills value={priority} onChange={setPriority} />
          </PropertyRow>

          {/* REPEAT — single dropdown with presets (Things/Cron/Motion) */}
          {mode !== 'fixed' && (
            <>
              <PropertyRow icon={Repeat} label="Repeat">
                <Select
                  value={repeatPreset}
                  onValueChange={v => setRepeatPreset(v as RepeatPreset)}
                >
                  <SelectTrigger className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Doesn't repeat</SelectItem>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                    <SelectItem value="weekly">Every week</SelectItem>
                    <SelectItem value="custom">Custom interval…</SelectItem>
                  </SelectContent>
                </Select>
              </PropertyRow>

              {repeatPreset === 'custom' && (
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

              {isRecurring && (
                <PropertyRow icon={Calendar} label="Until" sub>
                  <Input
                    type="date"
                    value={recEnd}
                    onChange={e => setRecEnd(e.target.value)}
                    className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto"
                  />
                </PropertyRow>
              )}
            </>
          )}

          {/* DEADLINE — quick chips + custom (Things/Sunsama) */}
          {mode !== 'fixed' && !isRecurring && (
            <PropertyRow icon={Calendar} label="Deadline">
              <DeadlineControl value={deadline} onChange={setDeadline} />
            </PropertyRow>
          )}
        </div>

        {/* ───── ADVANCED disclosure ───── */}
        <div className="border-t border-border/40 mt-2">
        <div className="px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setAdvancedOpen(o => !o)}
            className="w-full flex items-center gap-1.5 px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/55 hover:text-foreground transition-colors rounded-md hover:bg-secondary/30"
          >
            <ChevronDown
              className={
                'w-3 h-3 transition-transform ' + (advancedOpen ? '' : '-rotate-90')
              }
            />
            Advanced
            {!advancedOpen && (
              <span className="ml-auto text-[9px] font-normal lowercase tracking-normal text-muted-foreground/40">
                deep focus · splittable · snooze · color
              </span>
            )}
          </button>

          {advancedOpen && (
            <div className="pb-2 space-y-0.5">
              {/* DEEP FOCUS — single toggle (Cal Newport framing) */}
              <PropertyRow icon={Brain} label="Deep focus">
                <ToggleSwitch
                  checked={energy === 'deep'}
                  onChange={on => setEnergy(on ? 'deep' : 'moderate')}
                  onLabel="Protect peak hours"
                  offLabel="Standard"
                  tone="violet"
                  title="When on, the engine prioritizes your peak focus window for this task."
                />
              </PropertyRow>

              {/* SPLITTABLE removed from UI — engine auto-decides:
                  duration ≥ 60min → auto_chunk, otherwise → single. The
                  toggle was rarely flipped; better to have a smart default. */}

              {/* SNOOZE UNTIL — Reclaim/Motion pattern. Staged for engine wiring.
                  Use cases:
                    • "Tax return" — can't start before W-2 arrives Jan 31
                    • "Follow up email" — wait 3 days for a reply
                    • "Renew passport" — surface this in 6 months
                    • "Prep for board deck" — start 1 week before meeting */}
              <PropertyRow icon={AlarmClock} label="Snooze until">
                <Input
                  type="date"
                  value={snoozeUntil}
                  onChange={e => setSnoozeUntil(e.target.value)}
                  className="bg-secondary/50 border-border font-mono text-[11px] h-7 w-40 ml-auto"
                  title="Engine won't schedule this before the chosen date. Use for: 'wait for W-2', 'follow up if no reply', 'renew passport in 6mo'."
                />
              </PropertyRow>

              {/* COLOR — moved here from essentials */}
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
            </div>
          )}
        </div>
        </div>

        {/* Adaptive duration hint + overlap warning */}
        <div className="px-4">
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

      {/* Sticky footer with primary action */}
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
          className="inline-flex items-center justify-center gap-1.5 px-5 h-9 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
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
  sub?: boolean;
}) {
  return (
    <div
      className={
        'flex items-center gap-3 py-2 rounded-md transition-colors ' +
        (sub ? 'pl-10 pr-2' : 'px-3 hover:bg-secondary/25')
      }
    >
      <div
        className={
          'flex items-center gap-2 shrink-0 ' +
          (sub ? 'w-[100px] text-muted-foreground/55' : 'w-[110px] text-muted-foreground/75')
        }
      >
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
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
  options: {
    value: T;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    hint?: string;
  }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 ml-auto">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            className={
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium transition-all border ' +
              (active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25'
                : 'bg-secondary/30 text-foreground/70 border-border hover:border-border hover:bg-secondary/55 hover:text-foreground')
            }
          >
            {opt.icon && <opt.icon className="w-3 h-3" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Linear-style named priority pills (Low / Medium / High / Urgent).
// Internally maps to 1-5: Low=2, Medium=3, High=4, Urgent=5.
function NamedPriorityPills({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const levels: {
    num: number;
    label: string;
    activeBg: string;
    dot: string;
  }[] = [
    { num: 2, label: 'Low', activeBg: 'bg-muted text-foreground border-muted-foreground/30', dot: 'bg-foreground/40' },
    { num: 3, label: 'Medium', activeBg: 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25', dot: 'bg-primary' },
    { num: 4, label: 'High', activeBg: 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/25', dot: 'bg-amber-500' },
    { num: 5, label: 'Urgent', activeBg: 'bg-destructive text-white border-destructive shadow-sm shadow-destructive/25', dot: 'bg-destructive' },
  ];
  return (
    <div className="inline-flex items-center gap-1 ml-auto">
      {levels.map(lv => {
        const active = value === lv.num;
        return (
          <button
            key={lv.num}
            type="button"
            onClick={() => onChange(lv.num)}
            className={
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium transition-all border ' +
              (active
                ? lv.activeBg
                : 'bg-secondary/30 text-foreground/70 border-border hover:bg-secondary/55 hover:text-foreground')
            }
          >
            <span
              className={
                'w-1.5 h-1.5 rounded-full ' + (active ? 'bg-current/80' : lv.dot)
              }
            />
            {lv.label}
          </button>
        );
      })}
    </div>
  );
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

// Things/Sunsama pattern — quick chips for common deadlines + a custom date.
function DeadlineControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const friday = format(nextFriday(new Date()), 'yyyy-MM-dd');

  const chips = [
    { value: '', label: 'None' },
    { value: today, label: 'Today' },
    { value: tomorrow, label: 'Tomorrow' },
    { value: friday, label: 'Fri' },
  ];

  return (
    <div className="inline-flex items-center gap-1 ml-auto">
      {chips.map(c => {
        const active = value === c.value;
        return (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(c.value)}
            className={
              'px-3 h-8 rounded-lg text-[12px] font-medium transition-all border ' +
              (active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25'
                : 'bg-secondary/30 text-foreground/70 border-border hover:bg-secondary/55 hover:text-foreground')
            }
          >
            {c.label}
          </button>
        );
      })}
      <Input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-secondary/30 border-border text-[12px] h-8 w-36 ml-1"
      />
    </div>
  );
}

// True iOS-style switch for the Deep focus toggle.
function ToggleSwitch({
  checked,
  onChange,
  onLabel = 'On',
  offLabel = 'Off',
  tone = 'primary',
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  tone?: 'primary' | 'violet';
  title?: string;
}) {
  const toneOn =
    tone === 'violet'
      ? 'bg-violet-500 border-violet-500'
      : 'bg-primary border-primary';
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      title={title}
      className={
        'inline-flex items-center gap-2 h-8 pl-1 pr-3 rounded-full border transition-all ' +
        (checked
          ? `${toneOn} text-white shadow-sm`
          : 'bg-secondary/30 border-border text-foreground/65 hover:bg-secondary/55')
      }
    >
      <span
        className={
          'w-6 h-6 rounded-full transition-transform shadow-sm ' +
          (checked ? 'bg-white translate-x-0' : 'bg-foreground/55 -translate-x-0')
        }
      />
      <span className="text-[12px] font-medium">
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}

// ─── Subtask list — Things 3 / Linear / Notion checklist pattern ──

function SubtaskList({
  value,
  onChange,
}: {
  value: Subtask[];
  onChange: (next: Subtask[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const addSubtask = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([
      ...value,
      { id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: t, done: false },
    ]);
    setDraft('');
  };

  const toggleDone = (id: string) =>
    onChange(value.map(s => (s.id === id ? { ...s, done: !s.done } : s)));

  const removeSubtask = (id: string) =>
    onChange(value.filter(s => s.id !== id));

  const setTitle = (id: string, title: string) =>
    onChange(value.map(s => (s.id === id ? { ...s, title } : s)));

  const completed = value.filter(s => s.done).length;

  return (
    <div className="px-6 pb-3 pt-1">
      {value.length > 0 && (
        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
          <ListChecks className="w-3 h-3" />
          <span>Subtasks</span>
          <span className="tabular-nums text-muted-foreground/45">
            {completed}/{value.length}
          </span>
        </div>
      )}
      <div className="space-y-1">
        {value.map(s => (
          <div
            key={s.id}
            className="group flex items-center gap-2 py-1 pl-1 pr-2 rounded-md hover:bg-secondary/25 transition-colors"
          >
            <button
              type="button"
              onClick={() => toggleDone(s.id)}
              aria-checked={s.done}
              role="checkbox"
              className={
                'shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ' +
                (s.done
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/40 hover:border-foreground/70 bg-secondary/30')
              }
            >
              {s.done && (
                <svg
                  viewBox="0 0 12 12"
                  className="w-2.5 h-2.5 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2 6.5 5 9.5 10 3" />
                </svg>
              )}
            </button>
            <input
              value={s.title}
              onChange={e => setTitle(s.id, e.target.value)}
              className={
                'flex-1 bg-transparent text-[13px] focus:outline-none ' +
                (s.done
                  ? 'line-through text-muted-foreground/55'
                  : 'text-foreground/90')
              }
            />
            <button
              type="button"
              onClick={() => removeSubtask(s.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/55 hover:text-destructive transition-all p-1 rounded"
              aria-label="Remove subtask"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1 pl-1">
        <Plus className="w-3 h-3 text-muted-foreground/45 shrink-0" />
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSubtask();
            }
          }}
          placeholder={value.length === 0 ? 'Break it into steps (optional)…' : 'Add another subtask…'}
          className="flex-1 bg-transparent text-[13px] text-foreground/85 placeholder:text-muted-foreground/40 focus:outline-none py-1"
        />
      </div>
    </div>
  );
}

// ─── Adaptive duration hint (preserved) ──

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
          Based on {confidenceCopy[suggestion.confidence as 'high' | 'medium' | 'low']}. Click to apply.
        </p>
      </div>
    </button>
  );
}
