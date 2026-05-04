/**
 * UpcomingFlow — vertical "river of time" for the rest of today.
 *
 * Best-practice rejection: a 7×24 calendar grid is information-dense
 * but interaction-noisy. For "what's left today" — which is the actual
 * question users ask 80% of the time — a single vertical column with
 * time flowing downward is faster to scan and lighter to use.
 *
 * Each block is a colored card pinned at its hour. The "now" line
 * cuts across — past blocks fade, future blocks glow at their start.
 * Tap any block to feed it back into the assistant for action.
 */

import { useMemo } from 'react';
import { format, addHours, startOfDay, differenceInMinutes } from 'date-fns';
import { Task, ScheduledBlock } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';
import { Pin, Lock, CheckCircle2 } from 'lucide-react';

interface UpcomingFlowProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  now: Date;
  onTapBlock: (block: ScheduledBlock) => void;
}

const ROW_HEIGHT = 64; // px per hour
const MAX_HOURS = 12;
const MIN_HOURS = 4;

export function UpcomingFlow({ blocks, tasks, now, onTapBlock }: UpcomingFlowProps) {
  const startHour = now.getHours();

  // Pull blocks within the maximum window first; we'll shrink the
  // rendered window if the day has fewer blocks ahead.
  const maxWindowEnd = addHours(now, MAX_HOURS);
  const candidateBlocks = useMemo(() => {
    return blocks
      .filter(b => {
        const s = new Date(b.start_time);
        const e = new Date(b.end_time);
        return e > now && s < maxWindowEnd;
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [blocks, now, maxWindowEnd]);

  // Adaptive height: render from now to (last block + 1h buffer), with a
  // floor at MIN_HOURS so the surface doesn't look empty even on quiet
  // afternoons.
  const HOURS_AHEAD = useMemo(() => {
    if (candidateBlocks.length === 0) return MIN_HOURS;
    const lastEnd = new Date(
      candidateBlocks[candidateBlocks.length - 1].end_time
    );
    const hoursToLast = Math.ceil(
      (lastEnd.getTime() - now.getTime()) / 3_600_000
    );
    return Math.min(MAX_HOURS, Math.max(MIN_HOURS, hoursToLast + 1));
  }, [candidateBlocks, now]);

  const windowEnd = addHours(now, HOURS_AHEAD);
  const windowBlocks = candidateBlocks.filter(b => {
    return new Date(b.start_time) < windowEnd;
  });

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          {windowBlocks.length === 0
            ? 'nothing soon'
            : `next ${HOURS_AHEAD} hour${HOURS_AHEAD === 1 ? '' : 's'}`}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/45">
          {windowBlocks.length} block{windowBlocks.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative" style={{ height: HOURS_AHEAD * ROW_HEIGHT }}>
        {/* Hour gridlines */}
        {Array.from({ length: HOURS_AHEAD }).map((_, i) => {
          const hour = (startHour + i) % 24;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <div className="w-14 pt-1 px-3 text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 border-t border-border/30" />
            </div>
          );
        })}

        {/* Now line */}
        <NowLine now={now} startHour={startHour} />

        {/* Blocks */}
        <div className="absolute left-14 right-3 top-0 bottom-0">
          {windowBlocks.map(b => {
            const task = taskById.get(b.task_id);
            if (!task) return null;
            const blockStart = new Date(b.start_time);
            const blockEnd = new Date(b.end_time);
            const minutesIntoWindow =
              differenceInMinutes(blockStart, startOfDay(now)) - startHour * 60;
            const top = (minutesIntoWindow / 60) * ROW_HEIGHT;
            const height = Math.max(
              28,
              (differenceInMinutes(blockEnd, blockStart) / 60) * ROW_HEIGHT - 4
            );
            const color = getTaskColor(task.color ?? task.calendar_color);
            const isPast = blockEnd < now;
            const isActive = blockStart <= now && now < blockEnd;
            const isDone = !!b.completed_at;

            return (
              <button
                key={b.id}
                onClick={() => onTapBlock(b)}
                className="absolute left-0 right-0 px-3 py-2 rounded-xl text-left transition-all hover:translate-x-0.5 hover:shadow-lg group"
                style={{
                  top: Math.max(0, top),
                  height,
                  background: isDone
                    ? `${color.bg}1a`
                    : isActive
                    ? `${color.bg}55`
                    : `${color.bg}30`,
                  borderLeft: `3px solid ${color.border}${isPast || isDone ? '66' : 'ff'}`,
                  opacity: isDone ? 0.55 : isPast ? 0.45 : 1,
                  boxShadow: isActive
                    ? `0 0 24px -8px ${color.border}88`
                    : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-2 h-full">
                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        'text-[12px] font-medium truncate leading-tight ' +
                        (isDone ? 'text-foreground/55 line-through' : 'text-foreground')
                      }
                    >
                      {task.title}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground/65 mt-0.5 tabular-nums">
                      {format(blockStart, 'HH:mm')}–{format(blockEnd, 'HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {isDone && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400/85" />}
                    {b.locked && !isDone && (
                      <Lock className="w-2.5 h-2.5 text-muted-foreground/55" />
                    )}
                    {task.scheduling_mode === 'fixed' && !isDone && (
                      <Pin className="w-2.5 h-2.5 text-muted-foreground/55" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {windowBlocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[12px] font-mono text-muted-foreground/40">
                nothing on for the next {HOURS_AHEAD} hours
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NowLine({ now, startHour }: { now: Date; startHour: number }) {
  const minutesFromStart = (now.getHours() - startHour) * 60 + now.getMinutes();
  const top = (minutesFromStart / 60) * ROW_HEIGHT;
  return (
    <div
      className="absolute left-0 right-0 h-px bg-primary z-10 pointer-events-none"
      style={{ top }}
    >
      <div className="absolute left-11 -top-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,138,52,0.7)]" />
      <div className="absolute right-3 -top-2.5 text-[9px] font-mono text-primary/85 tabular-nums">
        now {format(now, 'HH:mm')}
      </div>
    </div>
  );
}
