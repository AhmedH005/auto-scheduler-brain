import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Task } from '@/types/task';
import { calculateScore } from '@/engine/scoring';
import { Trash2, Clock, Zap, Shield, Pin, Calendar, Sparkles, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';

type Filter = 'all' | 'today' | 'active' | 'done';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('active');

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      active: tasks.filter(t => t.status === 'active').length,
      today: tasks.filter(t => t.status === 'active' && t.deadline === todayKey).length,
      done: tasks.filter(t => t.status === 'completed').length,
    };
  }, [tasks, todayKey]);

  const filtered = useMemo(() => {
    let r = tasks;
    if (filter === 'active') r = r.filter(t => t.status === 'active');
    else if (filter === 'today') r = r.filter(t => t.status === 'active' && t.deadline === todayKey);
    else if (filter === 'done') r = r.filter(t => t.status === 'completed');
    return [...r].sort((a, b) => calculateScore(b) - calculateScore(a));
  }, [tasks, filter, todayKey]);

  // The empty-state checks visible-list emptiness, but only show the
  // illustrated empty when there are NO tasks at all (filter switching
  // to a filter with zero matches gets a smaller empty hint).
  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="px-2 py-8 text-center"
      >
        {/* Layered glyph — three concentric pulsing rings echoing the energy palette */}
        <div className="relative w-16 h-16 mx-auto mb-5">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: 'hsl(var(--energy-deep) / 0.18)' }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.3, 0.6] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-2 rounded-full"
            style={{ background: 'hsl(var(--energy-moderate) / 0.22)' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.25, 0.5] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-4 rounded-full flex items-center justify-center"
            style={{ background: 'hsl(var(--energy-light) / 0.28)' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            <Sparkles className="w-4 h-4 text-primary" />
          </motion.div>
        </div>

        <p className="text-sm font-sans font-medium text-foreground/85 mb-1.5 leading-snug">
          {t('taskList.noTasks')}
        </p>
        <p className="text-[11px] font-mono text-muted-foreground/55 mb-5 leading-relaxed max-w-[210px] mx-auto">
          {t('taskList.clickToAdd')}
        </p>

        <div className="flex flex-col gap-1 items-stretch text-left">
          <EmptyHint icon={Plus} label="Add a task" shortcut="A" />
          <EmptyHint icon={Sparkles} label="Open command palette" shortcut="⌘K" />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Filter chips */}
      <div className="flex items-center gap-0.5 px-1 py-1.5 mb-1.5 sticky top-0 bg-card/80 backdrop-blur z-10 -mx-2 px-2 rounded-md">
        {(
          [
            { key: 'active' as Filter, label: 'Active', count: counts.active },
            { key: 'today' as Filter, label: 'Today', count: counts.today },
            { key: 'all' as Filter, label: 'All', count: counts.all },
            { key: 'done' as Filter, label: 'Done', count: counts.done },
          ]
        ).map(({ key, label, count }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {label}
              <span className={`text-[9px] font-mono tabular-nums ${active ? 'text-primary/70' : 'text-muted-foreground/55'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty filter state */}
      {filtered.length === 0 && (
        <div className="px-3 py-8 text-center">
          <p className="text-caption">No tasks in {filter === 'today' ? 'today' : filter}.</p>
        </div>
      )}

      {/* Task rows */}
      <div className="flex flex-col gap-1.5">
      {filtered.map(task => {
        const score = calculateScore(task);
        const taskColor = getTaskColor(task.color);

        const modeIcon = task.scheduling_mode === 'anchor'
          ? <Shield className="w-2.5 h-2.5 text-accent-foreground" />
          : task.scheduling_mode === 'fixed'
          ? <Pin className="w-2.5 h-2.5 text-primary" />
          : null;

        const modeLabel = task.scheduling_mode === 'anchor'
          ? t('taskForm.mode.anchor')
          : task.scheduling_mode === 'fixed'
          ? t('taskForm.mode.fixed')
          : null;

        const dotColor = task.calendar_color ?? taskColor.border;

        return (
          <div
            key={task.id}
            className="group flex items-start gap-3 px-2.5 py-2.5 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer"
            onClick={() => onEdit(task)}
          >
            {/* Color dot — vertical bar (more elegant than circle, easier to scan) */}
            <div
              className="w-1 h-9 rounded-full shrink-0 mt-0.5 transition-all group-hover:w-[3px]"
              style={{ backgroundColor: dotColor }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-body font-medium text-foreground truncate leading-snug">
                  {task.title}
                </p>
                {task.sync_source === 'google' && (
                  <GoogleIcon size={9} className="shrink-0 opacity-55" />
                )}
                {task.is_recurring && (
                  <span className="text-[10px] text-primary/70 font-medium" aria-label="Recurring">↻</span>
                )}
              </div>
              <div className="flex items-center gap-2.5 mt-1 text-data text-muted-foreground flex-wrap leading-none">
                {task.scheduling_mode !== 'fixed' && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{task.total_duration}m</span>
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />
                  P{task.priority}
                </span>
                {modeIcon && (
                  <span className="flex items-center gap-0.5">
                    {modeIcon}
                    <span>{modeLabel}</span>
                  </span>
                )}
                {task.deadline && (
                  <span className="flex items-center gap-0.5 text-amber-300/85">
                    <Calendar className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{task.deadline.substring(5)}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {score >= 1.5 && (
                <div className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  score >= 4.0
                    ? 'text-destructive bg-destructive/10'
                    : score >= 2.8
                    ? 'text-amber-300 bg-amber-500/10'
                    : 'text-muted-foreground bg-secondary'
                }`}>
                  {score >= 4.0 ? 'Critical' : score >= 2.8 ? 'High' : 'Normal'}
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                aria-label="Delete task"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  label,
  shortcut,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/30 border border-border/60">
      <Icon className="w-3 h-3 text-muted-foreground/50" />
      <span className="text-[11px] font-mono text-muted-foreground/70 flex-1">{label}</span>
      <kbd className="text-[9px] font-mono text-muted-foreground/55 px-1.5 py-0.5 rounded border border-border bg-background/60">
        {shortcut}
      </kbd>
    </div>
  );
}
