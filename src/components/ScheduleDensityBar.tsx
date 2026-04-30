/**
 * ScheduleDensityBar — at-a-glance load preview for the next N days.
 *
 * One bar per day, fill height = scheduled minutes / max_total_hours_per_day.
 * Color tier:
 *   green  < 60%   — comfortably loaded
 *   amber  60–90%  — heavy
 *   red    > 90%   — at or over cap
 *
 * Reduces the planning fallacy by making over-commitment visually obvious
 * BEFORE the user adds the next "I'll just squeeze this in" task. Same
 * principle as the deficit indicators in YNAB / Sunsama.
 */

import { useMemo } from 'react';
import { ScheduledBlock, UserSettings } from '@/types/task';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { motion } from 'framer-motion';

interface ScheduleDensityBarProps {
  blocks: ScheduledBlock[];
  settings: UserSettings;
  /** How many days to show. Defaults to 14. */
  days?: number;
  /** Called when user clicks a day. */
  onDayClick?: (date: Date) => void;
}

export function ScheduleDensityBar({
  blocks,
  settings,
  days = 14,
  onDayClick,
}: ScheduleDensityBarProps) {
  const dayData = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: days }, (_, i) => {
      const date = addDays(start, i);
      const minutesUsed = blocks.reduce((acc, b) => {
        const blockStart = new Date(b.start_time);
        if (!isSameDay(blockStart, date)) return acc;
        const dur =
          (new Date(b.end_time).getTime() - blockStart.getTime()) / 60000;
        return acc + Math.max(dur, 0);
      }, 0);
      const capMinutes = settings.max_total_hours_per_day * 60;
      const ratio = capMinutes > 0 ? minutesUsed / capMinutes : 0;
      return {
        date,
        minutesUsed,
        capMinutes,
        ratio,
      };
    });
  }, [blocks, settings.max_total_hours_per_day, days]);

  return (
    <div className="px-3 py-2 border-b border-border bg-card/40">
      <div className="flex items-end justify-between gap-1 max-w-full">
        <div className="flex flex-col items-start mr-2 shrink-0">
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/55">
            Load
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {settings.max_total_hours_per_day}h cap
          </span>
        </div>

        <div className="flex items-end gap-[3px] flex-1 min-w-0 justify-start overflow-hidden">
          {dayData.map((d, i) => {
            const tier =
              d.ratio >= 0.9 ? 'red' : d.ratio >= 0.6 ? 'amber' : d.ratio > 0 ? 'green' : 'empty';
            const fillHeight = Math.min(d.ratio, 1.2) * 100;
            const today = isToday(d.date);

            const tierBg: Record<typeof tier, string> = {
              green: 'bg-emerald-500/55',
              amber: 'bg-amber-500/65',
              red: 'bg-red-500/70',
              empty: 'bg-muted/40',
            };

            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015, duration: 0.3, ease: [0.2, 0, 0, 1] }}
                onClick={() => onDayClick?.(d.date)}
                className={`group flex flex-col items-center gap-0.5 ${onDayClick ? 'cursor-pointer' : ''}`}
                title={`${format(d.date, 'EEE MMM d')} — ${(d.minutesUsed / 60).toFixed(1)}h / ${settings.max_total_hours_per_day}h${d.ratio > 1 ? ' (over)' : ''}`}
              >
                {/* Bar */}
                <div className="relative w-[12px] sm:w-[16px] h-7 rounded-sm bg-secondary/40 overflow-hidden">
                  {tier !== 'empty' && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${fillHeight}%` }}
                      transition={{
                        duration: 0.6,
                        delay: 0.1 + i * 0.02,
                        ease: [0.2, 0, 0, 1],
                      }}
                      className={`absolute bottom-0 left-0 right-0 ${tierBg[tier]} group-hover:brightness-125 transition-all`}
                    />
                  )}
                  {/* Cap line */}
                  <div className="absolute left-0 right-0 h-px bg-border/60" style={{ bottom: '83.3%' }} />
                </div>

                {/* Day label */}
                <span
                  className={`text-[9px] font-mono leading-none ${
                    today
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground/55 group-hover:text-foreground'
                  }`}
                >
                  {format(d.date, 'EEEEE')}
                  {/* eee = single-letter day, more compact */}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-2 shrink-0 text-[9px] font-mono text-muted-foreground/45">
          <Legend color="bg-emerald-500/60" label="ok" />
          <Legend color="bg-amber-500/60" label="heavy" />
          <Legend color="bg-red-500/60" label="cap" />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
