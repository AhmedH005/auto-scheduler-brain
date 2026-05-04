/**
 * DeadlinesStrip — horizontal scroll showing what's due soon.
 *
 * A glanceable pressure gauge. If a user has nothing due, this hides
 * itself entirely (no "you're all caught up!" empty state — that's
 * noise). If they do, urgency is encoded by color: red for overdue,
 * amber for today, primary for upcoming.
 *
 * Click a chip → axis briefs you on the task in the thread.
 */

import { useMemo } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { Calendar, AlertOctagon, Clock } from 'lucide-react';
import { Task } from '@/types/task';

interface DeadlinesStripProps {
  tasks: Task[];
  onTapTask: (task: Task) => void;
}

export function DeadlinesStrip({ tasks, onTapTask }: DeadlinesStripProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const sorted = useMemo(() => {
    return tasks
      .filter(t => t.status === 'active' && t.deadline)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .slice(0, 6);
  }, [tasks]);

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-2.5 border-b border-border/60 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          due soon
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/45">
          {sorted.length} ahead
        </span>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {sorted.map(task => {
          const days = differenceInCalendarDays(
            new Date(task.deadline!),
            new Date()
          );
          const overdue = days < 0;
          const dueToday = days === 0;

          const colorClass = overdue
            ? 'bg-destructive/15 text-destructive border-destructive/30'
            : dueToday
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
            : days <= 2
            ? 'bg-amber-500/10 text-amber-300/85 border-amber-500/25'
            : 'bg-primary/10 text-primary/85 border-primary/25';

          const Icon = overdue ? AlertOctagon : dueToday ? Clock : Calendar;
          const label = overdue
            ? `${Math.abs(days)}d late`
            : dueToday
            ? 'today'
            : days === 1
            ? 'tomorrow'
            : `in ${days}d`;

          return (
            <button
              key={task.id}
              onClick={() => onTapTask(task)}
              className={
                'shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium hover:scale-[1.02] active:scale-[0.98] transition-all ' +
                colorClass
              }
              title={task.title}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="max-w-[140px] truncate">{task.title}</span>
              <span className="text-[9px] font-mono opacity-75">·</span>
              <span className="text-[9px] font-mono tabular-nums">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
