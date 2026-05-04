/**
 * MonthGlance — replaces the traditional month grid view with a density
 * heat map. Each cell is a day; fill height + color intensity = scheduled
 * load that day. No event labels, no overlapping rectangles. Just a
 * visual snapshot of "where is this month dense?"
 *
 * Click any cell → switch to TimeStream centered on that day.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScheduledBlock, UserSettings } from '@/types/task';

interface MonthGlanceProps {
  blocks: ScheduledBlock[];
  settings: UserSettings;
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  onDayClick: (d: Date) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthGlance({
  blocks,
  settings,
  selectedDate,
  onDateChange,
  onDayClick,
}: MonthGlanceProps) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  // Per-day scheduled minutes
  const minutesByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blocks) {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const dur = Math.max(0, (end.getTime() - start.getTime()) / 60000);
      const key = format(start, 'yyyy-MM-dd');
      m.set(key, (m.get(key) ?? 0) + dur);
    }
    return m;
  }, [blocks]);

  const capMinutes = settings.max_total_hours_per_day * 60;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-[920px] mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-eyebrow text-primary/85 mb-1">Density</p>
            <h1 className="text-display text-3xl sm:text-4xl text-foreground tracking-tight">
              {format(selectedDate, 'MMMM yyyy')}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NavButton
              onClick={() => onDateChange(subMonths(selectedDate, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </NavButton>
            <NavButton
              onClick={() => onDateChange(addMonths(selectedDate, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </NavButton>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-2 mb-2 px-1">
          {WEEKDAY_LABELS.map(l => (
            <span key={l} className="text-eyebrow text-muted-foreground/45 text-center">
              {l}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const dayKey = format(d, 'yyyy-MM-dd');
            const minutes = minutesByDate.get(dayKey) ?? 0;
            const ratio = capMinutes > 0 ? Math.min(minutes / capMinutes, 1.2) : 0;
            const inMonth = isSameMonth(d, selectedDate);
            const today = isToday(d);
            const selected = isSameDay(d, selectedDate);

            // Density tier
            const tier =
              ratio >= 0.9 ? 'red' : ratio >= 0.6 ? 'amber' : ratio > 0 ? 'green' : 'empty';

            const tierBg = {
              red: 'hsl(0 75% 58% / 0.7)',
              amber: 'hsl(28 90% 60% / 0.7)',
              green: 'hsl(158 50% 50% / 0.55)',
              empty: 'transparent',
            }[tier];

            return (
              <motion.button
                key={dayKey}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: inMonth ? 1 : 0.3, scale: 1 }}
                transition={{ delay: i * 0.008, duration: 0.25 }}
                onClick={() => onDayClick(d)}
                className={`group relative aspect-[4/5] rounded-lg overflow-hidden transition-all ${
                  selected
                    ? 'ring-2 ring-primary/50'
                    : today
                    ? 'ring-1 ring-primary/30'
                    : 'hover:ring-1 hover:ring-border'
                }`}
                style={{
                  background: 'hsl(var(--card) / 0.5)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
                title={`${format(d, 'EEE MMM d')} — ${(minutes / 60).toFixed(1)}h scheduled`}
              >
                {/* Density fill (rises from bottom) */}
                {tier !== 'empty' && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.min(ratio, 1) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.008 + 0.1 }}
                    className="absolute bottom-0 left-0 right-0"
                    style={{ background: tierBg }}
                  />
                )}

                {/* Cap line at 100% */}
                <div
                  className="absolute left-1 right-1 h-px"
                  style={{ bottom: '100%', background: 'hsl(var(--border) / 0.4)' }}
                />

                {/* Day number */}
                <div className="absolute inset-0 p-2 flex flex-col">
                  <span
                    className={`text-data-lg tabular-nums leading-none ${
                      today
                        ? 'text-primary font-bold'
                        : inMonth
                        ? 'text-foreground/90'
                        : 'text-muted-foreground/40'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                  {minutes > 0 && (
                    <span className="mt-auto text-[9px] font-mono text-foreground/65 leading-none tabular-nums">
                      {(minutes / 60).toFixed(1)}h
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[10px] font-mono text-muted-foreground/55">
          <Legend swatch="hsl(158 50% 50% / 0.55)" label={`< 60% of cap`} />
          <Legend swatch="hsl(28 90% 60% / 0.7)" label={`heavy`} />
          <Legend swatch="hsl(0 75% 58% / 0.7)" label={`at cap`} />
          <span className="text-muted-foreground/40">
            ({settings.max_total_hours_per_day}h/day cap)
          </span>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
      {...props}
    >
      {children}
    </button>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm" style={{ background: swatch }} />
      {label}
    </span>
  );
}
