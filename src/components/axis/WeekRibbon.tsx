/**
 * WeekRibbon — birds-eye view of this week, 7 thin columns.
 *
 * Each column is a 24-hour vertical bar with task blocks colored.
 * Click a day to focus it. No drag-to-reschedule here — that's the
 * grid-app paradigm we're rejecting. Just a glanceable week shape.
 */

import { useMemo } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  differenceInMinutes,
  startOfDay,
} from 'date-fns';
import { Task, ScheduledBlock } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';

interface WeekRibbonProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}

const COL_HEIGHT = 64; // px

export function WeekRibbon({
  blocks,
  tasks,
  selectedDate,
  onSelectDate,
}: WeekRibbonProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          this week
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/45">
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(d => {
          const dayBlocks = blocks.filter(b => isSameDay(new Date(b.start_time), d));
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, new Date());
          const totalMins = dayBlocks.reduce(
            (acc, b) =>
              acc + differenceInMinutes(new Date(b.end_time), new Date(b.start_time)),
            0
          );
          const totalHours = (totalMins / 60).toFixed(1);

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={
                'flex flex-col items-stretch group transition-all rounded-md ' +
                (isSelected ? 'opacity-100' : 'opacity-65 hover:opacity-100')
              }
              aria-label={format(d, 'EEEE, MMMM d')}
            >
              <div className="text-center mb-1.5">
                <div
                  className={
                    'text-[10px] font-mono uppercase tracking-wider leading-none ' +
                    (isToday ? 'text-primary' : 'text-muted-foreground/55')
                  }
                >
                  {format(d, 'EEE')}
                </div>
                <div
                  className={
                    'text-[14px] font-semibold tabular-nums leading-tight mt-0.5 ' +
                    (isToday
                      ? 'text-primary'
                      : isSelected
                      ? 'text-foreground'
                      : 'text-foreground/70')
                  }
                >
                  {format(d, 'd')}
                </div>
              </div>
              <div
                className={
                  'relative rounded-md overflow-hidden ' +
                  (isSelected
                    ? 'bg-secondary/60 ring-1 ring-primary/30'
                    : 'bg-secondary/30')
                }
                style={{ height: COL_HEIGHT }}
              >
                {dayBlocks.map(b => {
                  const task = taskById.get(b.task_id);
                  if (!task) return null;
                  const start = new Date(b.start_time);
                  const end = new Date(b.end_time);
                  const minStart = differenceInMinutes(start, startOfDay(start));
                  const minEnd = differenceInMinutes(end, startOfDay(start));
                  const topPct = (minStart / (24 * 60)) * 100;
                  const heightPct = ((minEnd - minStart) / (24 * 60)) * 100;
                  const color = getTaskColor(task.color ?? task.calendar_color);
                  // Convert percentage height to absolute pixels, then clamp:
                  // very-short blocks become tiny invisible slivers otherwise.
                  const heightPx = Math.max(4, (heightPct / 100) * COL_HEIGHT);
                  return (
                    <div
                      key={b.id}
                      className="absolute left-0.5 right-0.5 rounded-sm"
                      style={{
                        top: `${topPct}%`,
                        height: heightPx,
                        background: color.border,
                        opacity: b.completed_at ? 0.45 : 0.92,
                      }}
                      title={task.title}
                    />
                  );
                })}
              </div>
              <div
                className={
                  'text-center text-[9px] font-mono mt-1 tabular-nums leading-none ' +
                  (totalMins > 0
                    ? isSelected
                      ? 'text-primary/80'
                      : 'text-muted-foreground/55'
                    : 'text-muted-foreground/25')
                }
              >
                {totalMins > 0 ? `${totalHours}h` : '—'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
