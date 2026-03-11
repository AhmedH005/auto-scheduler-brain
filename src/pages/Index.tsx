import { useState, useEffect } from 'react';
import { useScheduler } from '@/hooks/useScheduler';
import { WeekView } from '@/components/WeekView';
import { DayView } from '@/components/DayView';
import { MonthView } from '@/components/MonthView';
import { TaskForm } from '@/components/TaskForm';
import { TaskList } from '@/components/TaskList';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Settings, Brain, ChevronLeft, ChevronRight, CalendarDays, Calendar, LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type SidePanel = 'tasks' | 'add' | 'edit' | 'settings' | null;
type CalendarView = 'day' | 'week' | 'month';

const Index = () => {
  const { t } = useTranslation();
  const {
    tasks, blocks, settings,
    addTask, updateTask, deleteTask,
    lockBlock, unlockBlock, deleteBlock, moveBlock, resizeBlock,
    rebuild, updateSettings,
  } = useScheduler();

  const [sidePanel, setSidePanel] = useState<SidePanel>('tasks');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>();
  const [quickAddTime, setQuickAddTime] = useState<string | undefined>();

  useEffect(() => {
    if (tasks.length > 0 && blocks.length === 0) rebuild();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTask = (task: Task) => {
    addTask(task);
    setSidePanel('tasks');
    setTimeout(() => rebuild(), 100);
  };

  const handleUpdateTask = (task: Task) => {
    updateTask(task.id, task);
    setEditingTask(null);
    setSidePanel('tasks');
    setTimeout(() => rebuild(), 100);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
    setTimeout(() => rebuild(), 100);
  };

  const handleQuickAdd = (date: string, time: string) => {
    setQuickAddDate(date);
    setQuickAddTime(time);
    setEditingTask(null);
    setSidebarOpen(true);
    setSidePanel('add');
  };

  const clearQuickAdd = () => {
    setQuickAddDate(undefined);
    setQuickAddTime(undefined);
  };

  const handleMonthDayClick = (date: Date) => {
    setSelectedDate(date);
    setCalendarView('day');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-72 border-r border-border flex flex-col bg-card shrink-0">
          <div className="px-3 py-2.5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs font-bold tracking-wider text-primary">{t('app.name')}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThemeSwitcher />
                <LanguageSwitcher />
              </div>
            </div>
          </div>

          <div className="px-2 py-1.5 flex gap-1 border-b border-border">
            <Button size="sm" variant={sidePanel === 'tasks' ? 'default' : 'ghost'} className="flex-1 font-mono text-[10px] h-7" onClick={() => setSidePanel('tasks')}>
              {t('sidebar.tasks')} ({tasks.filter(t => t.status === 'active').length})
            </Button>
            <Button size="sm" variant="ghost" className="font-mono text-[10px] h-7 px-2" onClick={() => { clearQuickAdd(); setSidePanel('add'); }}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="font-mono text-[10px] h-7 px-2" onClick={() => setSidePanel('settings')}>
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {sidePanel === 'tasks' && (
              <TaskList tasks={tasks} onEdit={t => { setEditingTask(t); setSidePanel('edit'); }} onDelete={handleDeleteTask} />
            )}
            {sidePanel === 'add' && (
              <TaskForm
                onSubmit={task => { handleAddTask(task); clearQuickAdd(); }}
                onClose={() => { setSidePanel('tasks'); clearQuickAdd(); }}
                existingBlocks={blocks}
                existingTasks={tasks}
                quickAddDate={quickAddDate}
                quickAddTime={quickAddTime}
              />
            )}
            {sidePanel === 'edit' && editingTask && (
              <TaskForm initialTask={editingTask} onSubmit={handleUpdateTask} onClose={() => { setEditingTask(null); setSidePanel('tasks'); }} existingBlocks={blocks} existingTasks={tasks} />
            )}
            {sidePanel === 'settings' && (
              <SettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setSidePanel('tasks')} />
            )}
          </div>

          <div className="px-2 py-2 border-t border-border">
            <Button onClick={rebuild} className="w-full font-mono text-xs tracking-wider h-8 animate-pulse-glow" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t('sidebar.rebuildSchedule')}
            </Button>
          </div>
        </div>
      )}

      {/* Toggle sidebar */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-card border border-border rounded-r-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        style={{ left: sidebarOpen ? '288px' : '0' }}
      >
        {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Calendar area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* View switcher */}
        <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
          {([
            { value: 'day', label: t('calendar.day'), icon: CalendarDays },
            { value: 'week', label: t('calendar.week'), icon: Calendar },
            { value: 'month', label: t('calendar.month'), icon: LayoutGrid },
          ] as const).map(v => (
            <Button
              key={v.value}
              variant={calendarView === v.value ? 'default' : 'ghost'}
              size="sm"
              className="font-mono text-[10px] h-6 px-2 gap-1"
              onClick={() => setCalendarView(v.value)}
            >
              <v.icon className="w-3 h-3" />
              {v.label}
            </Button>
          ))}
        </div>

        {/* View content */}
        <div className="flex-1 min-h-0">
          {calendarView === 'day' && (
            <DayView
              blocks={blocks} tasks={tasks} settings={settings}
              selectedDate={selectedDate} onDateChange={setSelectedDate}
              onMoveBlock={moveBlock} onResizeBlock={resizeBlock}
              onLockBlock={lockBlock} onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock} onQuickAdd={handleQuickAdd}
            />
          )}
          {calendarView === 'week' && (
            <WeekView
              blocks={blocks} tasks={tasks} settings={settings}
              onMoveBlock={moveBlock} onResizeBlock={resizeBlock}
              onLockBlock={lockBlock} onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock} onQuickAdd={handleQuickAdd}
            />
          )}
          {calendarView === 'month' && (
            <MonthView
              blocks={blocks} tasks={tasks}
              selectedDate={selectedDate} onDateChange={setSelectedDate}
              onDayClick={handleMonthDayClick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
