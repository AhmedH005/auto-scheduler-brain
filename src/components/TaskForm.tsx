import React, { useState } from 'react';
import { Task, EnergyIntensity, SchedulingMode, ExecutionStyle, RecurrencePattern } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Check, X, Calendar, Clock, Zap, Repeat, Shield, Pin, Shuffle, AlertTriangle } from 'lucide-react';
import { ScheduledBlock } from '@/types/task';
import { TASK_COLORS, DEFAULT_COLOR_ID } from '@/lib/taskColors';
import { useTranslation } from 'react-i18next';

interface TaskFormProps {
  onSubmit: (task: Task) => void;
  onClose: () => void;
  initialTask?: Partial<Task>;
  existingBlocks?: ScheduledBlock[];
  existingTasks?: Task[];
  quickAddDate?: string; // yyyy-MM-dd — pre-fills Fixed mode when clicking a slot
  quickAddTime?: string; // HH:mm
}

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

export function TaskForm({ onSubmit, onClose, initialTask, existingBlocks = [], existingTasks = [], quickAddDate, quickAddTime }: TaskFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [color, setColor] = useState(initialTask?.color || DEFAULT_COLOR_ID);
  const [duration, setDuration] = useState(initialTask?.total_duration || 30);
  const [priority, setPriority] = useState(initialTask?.priority || 3);

  const [mode, setMode] = useState<SchedulingMode>(() => {
    if (quickAddDate && quickAddTime) return 'fixed';
    const m = initialTask?.scheduling_mode === 'windowed' as string
      ? 'anchor'
      : (initialTask?.scheduling_mode || 'flexible');
    return m as SchedulingMode;
  });

  const [deadline, setDeadline] = useState(initialTask?.deadline || '');
  const [energy, setEnergy] = useState<EnergyIntensity>(initialTask?.energy_intensity || 'moderate');
  const [execStyle, setExecStyle] = useState<ExecutionStyle>(initialTask?.execution_style || 'auto_chunk');
  const [isRecurring, setIsRecurring] = useState(initialTask?.is_recurring || false);
  const [recPattern, setRecPattern] = useState<RecurrencePattern>(initialTask?.recurrence_pattern || 'weekdays');
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
      return checkOverlap(fixedDate, fixedStartTime, fixedEndTime, existingBlocks, existingTasks, initialTask?.id);
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
      total_duration: mode === 'fixed' ? 0 : (mode === 'anchor' && anchorStart && anchorEnd ? timeToMinutes(anchorEnd) - timeToMinutes(anchorStart) : duration),
      priority,
      deadline: mode === 'flexible' ? (isRecurring ? (recEnd || null) : (deadline || null)) : null,
      energy_intensity: energy,
      scheduling_mode: mode,
      window_start: mode === 'anchor' ? (anchorStart || null) : null,
      window_end: mode === 'anchor' ? (anchorEnd || null) : null,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      execution_style: mode === 'fixed' || mode === 'anchor' ? 'single' : execStyle,
      is_recurring: mode === 'fixed' ? false : isRecurring,
      recurrence_pattern: isRecurring && mode !== 'fixed' ? recPattern : null,
      recurrence_interval: recInterval,
      recurrence_end: (isRecurring && recEnd) ? recEnd : null,
      status: 'active',
      created_at: initialTask?.created_at || new Date().toISOString(),
      // Preserve sync metadata if editing an imported task
      ...(initialTask?.sync_source    && { sync_source:       initialTask.sync_source }),
      ...(initialTask?.provider_event_id && { provider_event_id: initialTask.provider_event_id }),
      ...(initialTask?.calendar_color && { calendar_color:    initialTask.calendar_color }),
    };

    onSubmit(task);
  };

  const priorityLabels = t('taskForm.priorityLabels', { returnObjects: true }) as string[];

  return (
    <form onSubmit={handleSubmit} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(e as unknown as React.FormEvent); }} className="flex flex-col gap-4 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border">
        <h3 className="font-mono text-xs font-semibold text-primary tracking-widest uppercase">
          {initialTask?.id ? t('taskForm.editTask') : t('taskForm.newTask')}
        </h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('taskForm.namePlaceholder')}
          className="bg-secondary border-border font-sans text-sm h-9"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('taskForm.descriptionPlaceholder')}
          rows={2}
          className="w-full resize-none rounded-md bg-secondary border border-border px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Color picker */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{t('taskForm.color')}</Label>
        <div className="flex gap-1.5 flex-wrap">
          {TASK_COLORS.map(c => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => setColor(c.id)}
              className={`w-5 h-5 rounded-full transition-all border-2 ${color === c.id ? 'scale-125 border-white/60' : 'border-transparent hover:scale-110'}`}
              style={{ backgroundColor: c.border }}
            />
          ))}
        </div>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-1">
        {([
          { value: 'flexible', labelKey: 'taskForm.mode.flexible', icon: Shuffle },
          { value: 'anchor', labelKey: 'taskForm.mode.anchor', icon: Shield },
          { value: 'fixed', labelKey: 'taskForm.mode.fixed', icon: Pin },
        ] as const).map(m => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-md text-xs font-mono transition-all border ${
              mode === m.value
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
            }`}
          >
            <m.icon className="w-3.5 h-3.5" />
            <span className="font-semibold text-[10px]">{t(m.labelKey)}</span>
          </button>
        ))}
      </div>

      {mode === 'flexible' && (
        <>
          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {t('taskForm.duration')} — <span className="text-primary">{duration}m</span>
            </Label>
            <div className="flex gap-1 items-center">
              {[15, 30, 45, 60, 90, 120].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`flex-1 px-0.5 py-1 text-[10px] font-mono rounded transition-all border ${
                    duration === d
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d}
                </button>
              ))}
              <Input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={e => setDuration(Math.max(5, Number(e.target.value)))}
                className="w-14 text-center text-[10px] font-mono bg-secondary border-border h-7 px-1"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {t('taskForm.priority')} — <span className="text-foreground">{priorityLabels[priority]}</span>
            </Label>
            <Slider value={[priority]} onValueChange={v => setPriority(v[0])} min={1} max={5} step={1} />
          </div>

          {/* Deadline — hidden when recurring (the "Until" date replaces it) */}
          {!isRecurring && (
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t('taskForm.deadline')} <span className="opacity-50">{t('taskForm.optional')}</span>
              </Label>
              <Input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="bg-secondary border-border font-mono text-sm h-8"
              />
            </div>
          )}

          {/* Energy + Execution row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> {t('taskForm.energy')}
              </Label>
              <Select value={energy} onValueChange={v => setEnergy(v as EnergyIntensity)}>
                <SelectTrigger className="bg-secondary border-border font-mono text-[11px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deep">{t('taskForm.energyLevels.deep')}</SelectItem>
                  <SelectItem value="moderate">{t('taskForm.energyLevels.moderate')}</SelectItem>
                  <SelectItem value="light">{t('taskForm.energyLevels.light')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> {t('taskForm.execution')}
              </Label>
              <Select value={execStyle} onValueChange={v => setExecStyle(v as ExecutionStyle)}>
                <SelectTrigger className="bg-secondary border-border font-mono text-[11px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{t('taskForm.executionStyles.single')}</SelectItem>
                  <SelectItem value="split">{t('taskForm.executionStyles.split')}</SelectItem>
                  <SelectItem value="auto_chunk">{t('taskForm.executionStyles.auto')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Repeat className="w-3 h-3" /> {t('taskForm.recurring')}
            </Label>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <div className="space-y-2 pl-2 border-l-2 border-primary/10">
              <Select value={recPattern} onValueChange={v => setRecPattern(v as RecurrencePattern)}>
                <SelectTrigger className="bg-secondary border-border font-mono text-[11px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('taskForm.recurrencePatterns.daily')}</SelectItem>
                  <SelectItem value="weekdays">{t('taskForm.recurrencePatterns.weekdays')}</SelectItem>
                  <SelectItem value="weekly">{t('taskForm.recurrencePatterns.weekly')}</SelectItem>
                  <SelectItem value="custom">{t('taskForm.recurrencePatterns.custom')}</SelectItem>
                </SelectContent>
              </Select>
              {recPattern === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{t('taskForm.every')}</span>
                  <Input type="number" value={recInterval} onChange={e => setRecInterval(Number(e.target.value))} min={1} className="w-14 bg-secondary border-border font-mono text-[11px] h-7" />
                  <span className="text-[10px] font-mono text-muted-foreground">{t('taskForm.days')}</span>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.until')} <span className="opacity-50">{t('taskForm.optional')}</span></Label>
                <Input type="date" value={recEnd} onChange={e => setRecEnd(e.target.value)} className="bg-secondary border-border font-mono text-[11px] h-7" />
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'anchor' && (
        <div className="space-y-3 p-2.5 rounded-md bg-secondary/50 border border-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.from')}</Label>
              <Input type="time" value={anchorStart} onChange={e => setAnchorStart(e.target.value)} className="bg-background border-border font-mono text-sm h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.to')}</Label>
              <Input type="time" value={anchorEnd} onChange={e => setAnchorEnd(e.target.value)} className="bg-background border-border font-mono text-sm h-8" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Repeat className="w-3 h-3" /> {t('taskForm.recurring')}
            </Label>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
          {isRecurring && (
            <div className="space-y-2">
              <Select value={recPattern} onValueChange={v => setRecPattern(v as RecurrencePattern)}>
                <SelectTrigger className="bg-background border-border font-mono text-[11px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('taskForm.recurrencePatterns.daily')}</SelectItem>
                  <SelectItem value="weekdays">{t('taskForm.recurrencePatterns.weekdays')}</SelectItem>
                  <SelectItem value="weekly">{t('taskForm.recurrencePatterns.weekly')}</SelectItem>
                  <SelectItem value="custom">{t('taskForm.recurrencePatterns.custom')}</SelectItem>
                </SelectContent>
              </Select>
              {recPattern === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{t('taskForm.every')}</span>
                  <Input type="number" value={recInterval} onChange={e => setRecInterval(Number(e.target.value))} min={1} className="w-14 bg-background border-border font-mono text-[11px] h-7" />
                  <span className="text-[10px] font-mono text-muted-foreground">{t('taskForm.days')}</span>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.untilDate')} <span className="opacity-50">{t('taskForm.optional')}</span></Label>
                <Input type="date" value={recEnd} onChange={e => setRecEnd(e.target.value)} className="bg-background border-border font-mono text-[11px] h-7" />
              </div>
            </div>
          )}

          <div className="space-y-1 pt-1 border-t border-border/50">
            <Label className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
              {t('taskForm.priority')} — {priorityLabels[priority]}
            </Label>
            <Slider value={[priority]} onValueChange={v => setPriority(v[0])} min={1} max={5} step={1} />
          </div>
        </div>
      )}

      {mode === 'fixed' && (
        <div className="space-y-2.5 p-2.5 rounded-md bg-secondary/50 border border-border">
          <Input
            type="date"
            value={fixedDate}
            onChange={e => setFixedDate(e.target.value)}
            className="bg-background border-border font-mono text-sm h-8"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.from')}</Label>
              <Input type="time" value={fixedStartTime} onChange={e => setFixedStartTime(e.target.value)} className="bg-background border-border font-mono text-sm h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-mono text-muted-foreground">{t('taskForm.to')}</Label>
              <Input type="time" value={fixedEndTime} onChange={e => setFixedEndTime(e.target.value)} className="bg-background border-border font-mono text-sm h-8" />
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-border/50">
            <Label className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
              {t('taskForm.priority')} — {priorityLabels[priority]}
            </Label>
            <Slider value={[priority]} onValueChange={v => setPriority(v[0])} min={1} max={5} step={1} />
          </div>
        </div>
      )}

      {/* Overlap warning */}
      {overlapWarning && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-[11px] font-mono">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{overlapWarning}</span>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" className="w-full font-mono text-xs tracking-widest h-8" size="sm" disabled={!!overlapWarning}>
        {initialTask?.id ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
        {initialTask?.id ? t('taskForm.update') : t('taskForm.addTask')}
      </Button>
    </form>
  );
}
