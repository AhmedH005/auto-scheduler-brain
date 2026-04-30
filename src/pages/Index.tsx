import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useScheduler } from '@/hooks/useScheduler';
import { WeekView } from '@/components/WeekView';
import { DayView } from '@/components/DayView';
import { MonthView } from '@/components/MonthView';
import { TaskForm } from '@/components/TaskForm';
import { TaskList } from '@/components/TaskList';
import { SettingsPanel } from '@/components/SettingsPanel';
import { CalendarIntegrationsPanel } from '@/components/CalendarIntegrationsPanel';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { RebuildPreviewSheet } from '@/components/RebuildPreviewSheet';
import { Task } from '@/types/task';
import { useExternalCalendars } from '@/hooks/useExternalCalendars';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Plus, Settings, Brain, ChevronLeft, ChevronRight,
  CalendarDays, Calendar, LayoutGrid, Undo2, AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { summarizeRebuild } from '@/engine/diff';

type SidePanel = 'tasks' | 'add' | 'edit' | 'settings' | 'integrations' | null;
type CalendarView = 'day' | 'week' | 'month';

const Index = () => {
  const { t } = useTranslation();
  const {
    tasks, blocks, settings,
    addTask, updateTask, deleteTask,
    lockBlock, unlockBlock, deleteBlock, moveBlock, resizeBlock,
    previewRebuild, applyPending, cancelPending, rebuild, undo,
    pendingResult, pendingDiff, lastResult, canUndo, summary,
    getDurationSuggestion,
    updateSettings, importSyncedTasks,
  } = useScheduler();

  const {
    accounts: calAccounts,
    calendars: calCalendars,
    syncedTasks,
    syncStatus,
    syncError,
    connectGoogle,
    syncAccount,
    disconnectAccount,
    toggleCalendar,
  } = useExternalCalendars();

  // Import new synced tasks into native AXIS tasks on first sync.
  useEffect(() => {
    if (syncedTasks.length > 0) importSyncedTasks(syncedTasks);
  }, [syncedTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sidePanel, setSidePanel] = useState<SidePanel>('tasks');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState<string | undefined>();
  const [quickAddTime, setQuickAddTime] = useState<string | undefined>();
  const lastResultIdRef = useRef<string | null>(null);

  // First-load auto rebuild — silent, no preview interruption
  useEffect(() => {
    if (tasks.length > 0 && blocks.length === 0) rebuild({ silent: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface summary toast after silent rebuilds (inline task add/edit/delete)
  useEffect(() => {
    if (!lastResult) return;
    if (lastResultIdRef.current === lastResult.computed_at) return;
    lastResultIdRef.current = lastResult.computed_at;

    const dropped = lastResult.dropped.length;
    const atRisk = lastResult.at_risk.length;

    if (dropped > 0) {
      toast.error(
        `${dropped} task${dropped > 1 ? 's' : ''} couldn't fit`,
        {
          description: lastResult.dropped.slice(0, 2).map(d => d.task_title).join(', ') +
            (dropped > 2 ? `, +${dropped - 2} more` : ''),
          duration: 6000,
        }
      );
    } else if (atRisk > 0) {
      toast.warning(
        `${atRisk} task${atRisk > 1 ? 's' : ''} at risk`,
        {
          description: lastResult.at_risk.slice(0, 2).map(r => r.task_title).join(', ') +
            (atRisk > 2 ? `, +${atRisk - 2} more` : ''),
          duration: 5000,
        }
      );
    }
  }, [lastResult]);

  // Cmd/Ctrl+Z = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      if (!isUndo) return;
      // Don't intercept while typing in form fields
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      e.preventDefault();
      if (canUndo) {
        undo();
        toast.success('Reverted last schedule change');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, undo]);

  const handleRebuild = () => {
    previewRebuild();
  };

  const handleApply = () => {
    if (!pendingResult || !pendingDiff) return;
    const summaryText = summarizeRebuild(pendingDiff, pendingResult);
    applyPending();
    toast.success('Schedule updated', { description: summaryText, duration: 4000 });
  };

  const handleAddTask = (task: Task) => {
    addTask(task);
    setSidePanel('tasks');
    setTimeout(() => rebuild({ silent: true }), 100);
  };

  const handleUpdateTask = (task: Task) => {
    updateTask(task.id, task);
    setEditingTask(null);
    setSidePanel('tasks');
    setTimeout(() => rebuild({ silent: true }), 100);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
    setTimeout(() => rebuild({ silent: true }), 100);
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
              <TaskList
                tasks={tasks}
                onEdit={t => { setEditingTask(t); setSidePanel('edit'); }}
                onDelete={handleDeleteTask}
              />
            )}
            {sidePanel === 'add' && (
              <TaskForm
                onSubmit={task => { handleAddTask(task); clearQuickAdd(); }}
                onClose={() => { setSidePanel('tasks'); clearQuickAdd(); }}
                existingBlocks={blocks}
                existingTasks={tasks}
                quickAddDate={quickAddDate}
                quickAddTime={quickAddTime}
                getDurationSuggestion={getDurationSuggestion}
              />
            )}
            {sidePanel === 'edit' && editingTask && (
              <TaskForm
                initialTask={editingTask}
                onSubmit={handleUpdateTask}
                onClose={() => { setEditingTask(null); setSidePanel('tasks'); }}
                existingBlocks={blocks}
                existingTasks={tasks}
                getDurationSuggestion={getDurationSuggestion}
              />
            )}
            {sidePanel === 'settings' && (
              <SettingsPanel
                settings={settings}
                onUpdate={updateSettings}
                onClose={() => setSidePanel('tasks')}
                onOpenIntegrations={() => setSidePanel('integrations')}
              />
            )}
            {sidePanel === 'integrations' && (
              <CalendarIntegrationsPanel
                accounts={calAccounts}
                calendars={calCalendars}
                syncStatus={syncStatus}
                syncError={syncError}
                onClose={() => setSidePanel('settings')}
                onConnectGoogle={connectGoogle}
                onSyncAccount={syncAccount}
                onDisconnectAccount={disconnectAccount}
                onToggleCalendar={toggleCalendar}
              />
            )}
          </div>

          {/* Schedule health summary — only renders when there's something to flag */}
          {(summary.atRiskTasks > 0 || summary.droppedTasks > 0) && (
            <div className="px-2 pt-2 pb-1 border-t border-border space-y-1">
              {summary.droppedTasks > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono bg-red-500/8 border border-red-500/20 text-red-400">
                  <AlertOctagon className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {summary.droppedTasks} task{summary.droppedTasks > 1 ? 's' : ''} couldn't fit
                  </span>
                </div>
              )}
              {summary.atRiskTasks > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-mono bg-amber-500/8 border border-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {summary.atRiskTasks} at risk near deadline
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="px-2 py-2 border-t border-border flex gap-1.5">
            <Button
              onClick={handleRebuild}
              className="flex-1 font-mono text-xs tracking-wider h-8 animate-pulse-glow"
              size="sm"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t('sidebar.rebuildSchedule')}
            </Button>
            <Button
              onClick={() => {
                undo();
                toast.success('Reverted last schedule change');
              }}
              disabled={!canUndo}
              variant="ghost"
              size="sm"
              className="font-mono text-xs h-8 px-2"
              title="Undo last change (⌘Z)"
              aria-label="Undo last schedule change"
            >
              <Undo2 className="w-3.5 h-3.5" />
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
              onEditTask={t => { setEditingTask(t); setSidebarOpen(true); setSidePanel('edit'); }}
            />
          )}
          {calendarView === 'week' && (
            <WeekView
              blocks={blocks} tasks={tasks} settings={settings}
              onMoveBlock={moveBlock} onResizeBlock={resizeBlock}
              onLockBlock={lockBlock} onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock} onQuickAdd={handleQuickAdd}
              onEditTask={t => { setEditingTask(t); setSidebarOpen(true); setSidePanel('edit'); }}
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

      {/* Rebuild preview — opens when user clicks Rebuild */}
      <RebuildPreviewSheet
        open={pendingResult !== null}
        result={pendingResult}
        diff={pendingDiff}
        tasks={tasks}
        onApply={handleApply}
        onCancel={cancelPending}
      />
    </div>
  );
};

export default Index;
