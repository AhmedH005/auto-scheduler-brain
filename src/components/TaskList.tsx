import { motion } from 'framer-motion';
import { Task } from '@/types/task';
import { calculateScore } from '@/engine/scoring';
import { Trash2, Clock, Zap, Shield, Pin, Calendar, Sparkles, Plus } from 'lucide-react';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useTranslation } from 'react-i18next';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  const { t } = useTranslation();
  const activeTasks = tasks.filter(task => task.status === 'active');
  const sorted = [...activeTasks].sort((a, b) => calculateScore(b) - calculateScore(a));

  if (sorted.length === 0) {
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
    <div className="flex flex-col gap-1.5">
      {sorted.map(task => {
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
            className="group flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary/80 transition-colors cursor-pointer border border-transparent hover:border-border"
            onClick={() => onEdit(task)}
          >
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: dotColor }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="text-sm font-sans truncate text-foreground leading-tight">{task.title}</div>
                {task.sync_source === 'google' && (
                  <GoogleIcon size={9} className="shrink-0 opacity-60" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground flex-wrap">
                {task.scheduling_mode !== 'fixed' && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {task.total_duration}m
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
                {task.is_recurring && (
                  <span className="text-primary font-semibold">↻</span>
                )}
                {task.deadline && (
                  <span className="flex items-center gap-0.5 text-accent-foreground">
                    <Calendar className="w-2.5 h-2.5" />
                    {task.deadline.substring(5)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                score >= 4.0
                  ? 'text-destructive bg-destructive/10 border-destructive/30'
                  : score >= 2.8
                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                  : score >= 1.5
                  ? 'text-muted-foreground bg-secondary border-border'
                  : 'text-muted-foreground/50 bg-transparent border-transparent'
              }`}>
                {score >= 4.0 ? 'Critical' : score >= 2.8 ? 'High' : score >= 1.5 ? 'Normal' : 'Low'}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                className="opacity-30 group-hover:opacity-100 text-destructive/50 hover:text-destructive transition-all p-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

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
