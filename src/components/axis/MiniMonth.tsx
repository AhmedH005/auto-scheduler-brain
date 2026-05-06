/**
 * MiniMonth — compact month picker for the sidebar.
 *
 * Pattern lineage: Cron / Apple Calendar / Outlook / Google Calendar
 * (when sidebar is open) all surface a small "today's month" with a
 * dot indicator on days that have events. Lets the user jump weeks
 * forward or back without opening the full Month view.
 *
 * 7×6 grid (always 42 cells — fixed height, no jitter when months
 * change). Click a date → onSelectDate. ‹ › arrows page months.
 */

import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScheduledBlock } from '@/types/task';

interface MiniMonthProps {
  selectedDate: Date;
  blocks: ScheduledBlock[];
  onSelectDate: (d: Date) => void;
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MiniMonth({ selectedDate, blocks, onSelectDate }: MiniMonthProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [viewMonth]);

  // Map of yyyy-mm-dd → block count, for the dot indicator
  const blocksByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blocks) {
      const key = b.start_time.slice(0, 10);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [blocks]);

  return (
    <section className="px-2.5 py-2 rounded-lg bg-secondary/15">
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="w-5 h-5 rounded text-muted-foreground/55 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button
          onClick={() => setViewMonth(new Date())}
          className="text-[11px] font-medium text-foreground/85 hover:text-foreground transition-colors px-1"
          title="Jump to current month"
        >
          {format(viewMonth, 'MMMM yyyy')}
        </button>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="w-5 h-5 rounded text-muted-foreground/55 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px mb-0.5">
        {WEEKDAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/40 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {days.map(d => {
          const inMonth = isSameMonth(d, viewMonth);
          const selected = isSameDay(d, selectedDate);
          const today = isToday(d);
          const hasBlocks = (blocksByDay.get(format(d, 'yyyy-MM-dd')) ?? 0) > 0;

          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={
                'relative h-6 rounded text-[10px] font-mono tabular-nums transition-colors flex items-center justify-center ' +
                (selected
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : today
                  ? 'text-primary font-semibold hover:bg-secondary/40'
                  : inMonth
                  ? 'text-foreground/85 hover:bg-secondary/40'
                  : 'text-muted-foreground/30 hover:bg-secondary/30')
              }
              title={format(d, 'EEEE, MMM d')}
            >
              {format(d, 'd')}
              {hasBlocks && !selected && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/70"
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
