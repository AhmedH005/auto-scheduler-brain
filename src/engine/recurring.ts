import { Task, TaskInstance } from '@/types/task';
import { addDays, format, getDay } from 'date-fns';

export function expandRecurringTasks(tasks: Task[], rangeStart: Date, rangeEnd: Date): TaskInstance[] {
  const instances: TaskInstance[] = [];

  for (const task of tasks) {
    if (task.status !== 'active') continue;

    if (!task.is_recurring) {
      instances.push({
        task,
        instance_date: '',
        remaining_duration: task.total_duration,
      });
      continue;
    }

    const dates = getRecurringDates(task, rangeStart, rangeEnd);
    for (const date of dates) {
      instances.push({
        task,
        instance_date: format(date, 'yyyy-MM-dd'),
        remaining_duration: task.total_duration,
      });
    }
  }

  return instances;
}

function getRecurringDates(task: Task, rangeStart: Date, rangeEnd: Date): Date[] {
  const dates: Date[] = [];
  const recEnd = task.recurrence_end ? new Date(task.recurrence_end) : rangeEnd;
  const effectiveEnd = recEnd < rangeEnd ? recEnd : rangeEnd;

  for (let d = new Date(rangeStart); d <= effectiveEnd; d = addDays(d, 1)) {
    switch (task.recurrence_pattern) {
      case 'daily':
        dates.push(new Date(d));
        break;
      case 'weekdays': {
        const day = getDay(d);
        if (day >= 1 && day <= 5) dates.push(new Date(d));
        break;
      }
      case 'weekly': {
        const taskDay = getDay(new Date(task.created_at));
        if (getDay(d) === taskDay) dates.push(new Date(d));
        break;
      }
      case 'custom': {
        const created = new Date(task.created_at);
        const diffDays = Math.floor((d.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const interval = Math.max(task.recurrence_interval || 1, 1);
        if (diffDays >= 0 && diffDays % interval === 0) {
          dates.push(new Date(d));
        }
        break;
      }
      default:
        break;
    }
  }

  return dates;
}
