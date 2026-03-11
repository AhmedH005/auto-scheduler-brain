import { useMemo } from 'react';
import { ScheduledBlock, Task } from '@/types/task';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { getTaskColor } from '@/lib/taskColors';

interface MonthViewProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({ blocks, tasks, selectedDate, onDateChange, onDayClick }: MonthViewProps) {
  const { t } = useTranslation();
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  // Build calendar grid
  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  // Group blocks by date
  const blocksByDate = useMemo(() => {
    const map = new Map<string, ScheduledBlock[]>();
    for (const b of blocks) {
      const d = format(new Date(b.start_time), 'yyyy-MM-dd');
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(b);
    }
    return map;
  }, [blocks]);

  const dayHeaders = t('calendar.dayHeaders', { returnObjects: true }) as string[];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background z-10 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDateChange(addMonths(selectedDate, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono font-semibold text-foreground">{format(selectedDate, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDateChange(addMonths(selectedDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-t border-border">
          {dayHeaders.map(d => (
            <div key={d} className="text-center py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{d}</div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(80px, 1fr))` }}>
          {weeks.map((week, wi) =>
            week.map((d, di) => {
              const ds = format(d, 'yyyy-MM-dd');
              const dayBlocks = blocksByDate.get(ds) || [];
              const inMonth = isSameMonth(d, selectedDate);
              const today = isToday(d);

              return (
                <div
                  key={`${wi}-${di}`}
                  className={`border-b border-r border-border p-1 cursor-pointer transition-colors hover:bg-secondary/30 ${
                    !inMonth ? 'opacity-30' : ''
                  } ${today ? 'bg-primary/[0.04]' : ''}`}
                  onClick={() => onDayClick(d)}
                >
                  <div className={`text-xs font-mono mb-1 ${today ? 'text-primary font-bold' : 'text-foreground'}`}>
                    {format(d, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayBlocks.slice(0, 3).map(block => {
                      const task = taskMap.get(block.task_id);
                      const c = getTaskColor(task?.color);
                      return (
                        <div
                          key={block.id}
                          className="text-[9px] font-mono truncate px-1 py-0.5 rounded-sm text-foreground"
                          style={{ backgroundColor: c.bg, borderLeft: `2px solid ${c.border}` }}
                        >
                          {task?.title || 'Task'}
                        </div>
                      );
                    })}
                    {dayBlocks.length > 3 && (
                      <div className="text-[9px] font-mono text-muted-foreground px-1">
                        {t('calendar.moreItems', { count: dayBlocks.length - 3 })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
