import { Task } from '@/types/task';
import { calculateScore } from '@/engine/scoring';
import { Trash2, Clock, Zap, Shield, Pin, Calendar } from 'lucide-react';
import { getTaskColor } from '@/lib/taskColors';
import { useTranslation } from 'react-i18next';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  const { t } = useTranslation();
  const activeTasks = tasks.filter(t => t.status === 'active');
  const sorted = [...activeTasks].sort((a, b) => calculateScore(b) - calculateScore(a));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-muted-foreground font-mono text-sm">{t('taskList.noTasks')}</div>
        <div className="text-muted-foreground/50 font-mono text-xs mt-1.5">{t('taskList.clickToAdd')}</div>
      </div>
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

        return (
          <div
            key={task.id}
            className="group flex items-start gap-2.5 px-2.5 py-2 rounded-md hover:bg-secondary/80 transition-colors cursor-pointer border border-transparent hover:border-border"
            onClick={() => onEdit(task)}
          >
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: taskColor.border }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-sans truncate text-foreground leading-tight">{task.title}</div>
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
              <div className="text-[9px] font-mono text-primary/60">
                {score.toFixed(1)}
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                className="opacity-0 group-hover:opacity-100 text-destructive/50 hover:text-destructive transition-all p-0.5"
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
