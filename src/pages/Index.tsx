import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useScheduler } from '@/hooks/useScheduler';
import { TaskForm } from '@/components/TaskForm';
import { TaskList } from '@/components/TaskList';
import { RebuildPreviewSheet } from '@/components/RebuildPreviewSheet';
import { CommandPalette } from '@/components/CommandPalette';
import { ScheduleDensityBar } from '@/components/ScheduleDensityBar';
import { InsightsBanner } from '@/components/InsightsBanner';
import { WeeklyRetrospectiveSheet } from '@/components/WeeklyRetrospectiveSheet';
import { FloatingFinishedPill } from '@/components/FloatingFinishedPill';
import { TopBar, type AppMode } from '@/components/TopBar';
import { NowView } from '@/components/NowView';
import { TimeStream } from '@/components/TimeStream';
import { MonthGlance } from '@/components/MonthGlance';
import { SettingsSheet } from '@/components/SettingsSheet';
import { IntegrationsSheet } from '@/components/IntegrationsSheet';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { Task } from '@/types/task';
import { useExternalCalendars } from '@/hooks/useExternalCalendars';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Plus, ChevronLeft, ChevronRight,
  Undo2, AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
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
    markBlockDone, markBlockReopen, markBlockSkipped, confirmAutoMarked, replanFromNow,
    setDayMode, getDayMode, dailyOverrides,
    insights, applyLearnedDeepWindow, applyLearnedCap,
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [retroOpen, setRetroOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [insightsDismissed, setInsightsDismissed] = useState<Set<string>>(new Set());
  // The new primary mode toggle. NOW = focus-mode execution view.
  // PLAN = the existing calendar grid (preserved as a tool).
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('axis_app_mode');
    return saved === 'plan' ? 'plan' : 'now';
  });
  useEffect(() => {
    localStorage.setItem('axis_app_mode', appMode);
  }, [appMode]);
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

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // ⌘K = command palette (works even inside fields)
      if (meta && key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      // ⌘\ = toggle sidebar (works even inside fields)
      if (meta && key === '\\') {
        e.preventDefault();
        setSidebarOpen(s => !s);
        return;
      }

      // ⌘, = open settings (mac convention)
      if (meta && key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // ⌘Z = undo (skip when typing)
      if (meta && key === 'z' && !e.shiftKey) {
        if (inField) return;
        e.preventDefault();
        if (canUndo) {
          undo();
          toast.success('Reverted last schedule change');
        }
        return;
      }

      // Single-letter shortcuts (skip when typing or palette open)
      if (inField || paletteOpen || meta || e.shiftKey || e.altKey) return;

      switch (key) {
        case 'r':
          e.preventDefault();
          previewRebuild();
          return;
        case 'a':
          e.preventDefault();
          clearQuickAdd();
          setSidebarOpen(true);
          setSidePanel('add');
          return;
        case 't':
          e.preventDefault();
          setSelectedDate(new Date());
          setCalendarView('day');
          return;
        case '1':
          e.preventDefault();
          setCalendarView('day');
          return;
        case '2':
          e.preventDefault();
          setCalendarView('week');
          return;
        case '3':
          e.preventDefault();
          setCalendarView('month');
          return;
        case '/':
          e.preventDefault();
          setPaletteOpen(true);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, undo, previewRebuild, paletteOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const hasActionableInsight =
    insights.energy.shift_recommended ||
    insights.capacity.reduce_recommended ||
    insights.capacity.raise_recommended ||
    insights.missed.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar — global navigation surface */}
      <TopBar
        mode={appMode}
        view={calendarView}
        selectedDate={selectedDate}
        hasInsights={hasActionableInsight}
        onModeChange={setAppMode}
        onViewChange={setCalendarView}
        onDateChange={setSelectedDate}
        onJumpToToday={() => {
          setSelectedDate(new Date());
          if (calendarView === 'month') setCalendarView('day');
        }}
        onOpenPalette={() => setPaletteOpen(true)}
        onAddTask={() => {
          clearQuickAdd();
          if (appMode === 'plan') {
            setSidebarOpen(true);
            setSidePanel('add');
          } else {
            // In NOW mode there's no sidebar — flip to plan mode + open form
            setAppMode('plan');
            setSidebarOpen(true);
            setSidePanel('add');
          }
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRetrospective={() => setRetroOpen(true)}
      />

      {/* NOW mode — the new primary execution surface */}
      {appMode === 'now' && (
        <NowView
          blocks={blocks}
          tasks={tasks}
          atRiskCount={summary.atRiskTasks}
          droppedCount={summary.droppedTasks}
          onMarkDone={(id, mins) => {
            markBlockDone(id, mins);
            toast.success('Marked done', { duration: 2500 });
          }}
          onMarkSkipped={(id) => {
            markBlockSkipped(id);
            toast.success('Skipped — will be replanned on next rebuild', { duration: 2500 });
          }}
          onLockBlock={lockBlock}
          onUnlockBlock={unlockBlock}
          onEditTask={(t) => {
            setEditingTask(t);
            setAppMode('plan');
            setSidebarOpen(true);
            setSidePanel('edit');
          }}
          onOpenRetrospective={() => setRetroOpen(true)}
        />
      )}

      {/* PLAN mode — the calendar grid (preserved tool) */}
      {appMode === 'plan' && (
      <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Sidebar — animated collapse */}
      {sidebarOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="border-r border-border flex flex-col bg-card/50 shrink-0 overflow-hidden"
          style={{ width: 280 }}
        >
          <div className="px-2 py-2 flex gap-1 border-b border-border/60">
            <Button
              size="sm"
              variant={sidePanel === 'tasks' ? 'default' : 'ghost'}
              className="flex-1 h-7 text-body font-medium"
              onClick={() => setSidePanel('tasks')}
            >
              {t('sidebar.tasks')} · {tasks.filter(t => t.status === 'active').length}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => { clearQuickAdd(); setSidePanel('add'); }}
              title="Add task (A)"
              aria-label="Add task"
            >
              <Plus className="w-3.5 h-3.5" />
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
            {/* Settings + Integrations now render as right-slide Sheets at
                the page root — they no longer take over the task-list panel.
                See SettingsSheet / IntegrationsSheet at the bottom of this
                component. */}
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
        </motion.div>
      )}

      {/* Toggle sidebar — animated to follow the sidebar's width */}
      <motion.button
        animate={{ left: sidebarOpen ? 280 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-20 bg-card border border-border rounded-r-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        title={sidebarOpen ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </motion.button>

      {/* Calendar area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Learning-layer nudges — only renders when there's actionable signal */}
        <InsightsBanner
          energy={insights.energy}
          capacity={insights.capacity}
          missed={insights.missed}
          dismissed={insightsDismissed}
          onDismiss={(key) => setInsightsDismissed(prev => new Set(prev).add(key))}
          onApplyEnergy={() => {
            applyLearnedDeepWindow();
            const s = String(insights.energy.suggested_start_hour).padStart(2, '0');
            const e = String(insights.energy.suggested_end_hour).padStart(2, '0');
            toast.success('Deep window updated', {
              description: `Now ${s}:00–${e}:00 — based on your real completion history.`,
              duration: 4500,
            });
          }}
          onApplyCapacity={() => {
            applyLearnedCap();
            toast.success(`Daily cap set to ${insights.capacity.suggested_cap_hours}h`, {
              description: insights.capacity.reason,
              duration: 4500,
            });
          }}
          onJumpToTask={(id) => {
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            setEditingTask(task);
            setSidebarOpen(true);
            setSidePanel('edit');
          }}
          onOpenRetrospective={() => setRetroOpen(true)}
        />

        {/* Schedule density — at-a-glance week load */}
        <ScheduleDensityBar
          blocks={blocks}
          settings={settings}
          dailyOverrides={dailyOverrides}
          onDayClick={(date) => {
            setSelectedDate(date);
            if (calendarView === 'month') setCalendarView('day');
          }}
        />

        {/* View content — view switcher moved to the global TopBar */}
        <div className="flex-1 min-h-0">
          {(calendarView === 'day' || calendarView === 'week') && (
            <TimeStream
              blocks={blocks}
              tasks={tasks}
              daysAhead={calendarView === 'day' ? 1 : 7}
              selectedDate={selectedDate}
              onMarkDone={(id, mins) => {
                markBlockDone(id, mins);
                toast.success('Marked done', { duration: 2500 });
              }}
              onMarkSkipped={(id) => {
                markBlockSkipped(id);
                toast.success('Skipped — will be replanned on next rebuild', { duration: 2500 });
              }}
              onLockBlock={lockBlock}
              onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock}
              onEditTask={(t) => {
                setEditingTask(t);
                setSidebarOpen(true);
                setSidePanel('edit');
              }}
              onAddInGap={(date, time, mins) => {
                handleQuickAdd(date, time);
                toast.message('Adding task in gap', {
                  description: `${mins}m available starting ${time}`,
                  duration: 2000,
                });
              }}
            />
          )}
          {calendarView === 'month' && (
            <MonthGlance
              blocks={blocks}
              settings={settings}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onDayClick={(d) => {
                setSelectedDate(d);
                setCalendarView('day');
              }}
            />
          )}
        </div>
      </div>
      </div>
      )}

      {/* Rebuild preview — opens when user clicks Rebuild */}
      <RebuildPreviewSheet
        open={pendingResult !== null}
        result={pendingResult}
        diff={pendingDiff}
        tasks={tasks}
        onApply={handleApply}
        onCancel={cancelPending}
      />

      {/* Settings & integrations — right-slide sheets that float over the
          canvas instead of replacing the task list. */}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        energyInsight={insights.energy}
        onUpdate={updateSettings}
        onApplyLearnedDeepWindow={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated', { description: insights.energy.reason, duration: 4500 });
        }}
        onOpenIntegrations={() => {
          setSettingsOpen(false);
          setIntegrationsOpen(true);
        }}
      />

      <IntegrationsSheet
        open={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
        accounts={calAccounts}
        calendars={calCalendars}
        syncStatus={syncStatus}
        syncError={syncError}
        onConnectGoogle={connectGoogle}
        onSyncAccount={syncAccount}
        onDisconnectAccount={disconnectAccount}
        onToggleCalendar={toggleCalendar}
      />

      {/* First-run onboarding — auto-shows for empty state, persists choice */}
      <OnboardingFlow
        hasNoTasks={tasks.length === 0}
        hasNoHistory={(insights.energy.sample_size ?? 0) === 0 && summary.placedBlocks === 0}
        settings={settings}
        onUpdateSettings={updateSettings}
        onAddSampleTask={(partial) => {
          const sample: Task = {
            id: `sample-${Date.now()}`,
            title: partial.title ?? 'Deep work — getting started with AXIS',
            description: partial.description,
            color: undefined,
            total_duration: partial.total_duration ?? 90,
            priority: partial.priority ?? 4,
            deadline: partial.deadline ?? null,
            energy_intensity: partial.energy_intensity ?? 'deep',
            scheduling_mode: partial.scheduling_mode ?? 'flexible',
            window_start: null,
            window_end: null,
            start_datetime: null,
            end_datetime: null,
            execution_style: partial.execution_style ?? 'single',
            is_recurring: partial.is_recurring ?? false,
            recurrence_pattern: null,
            recurrence_interval: 1,
            recurrence_end: null,
            status: partial.status ?? 'active',
            created_at: new Date().toISOString(),
          };
          handleAddTask(sample);
          toast.success('Sample task added', {
            description: 'Click Rebuild in ⌘K to see it placed. Edit or delete anytime.',
            duration: 4500,
          });
        }}
      />

      {/* Floating "confirm what happened" pill — only renders when there
          are auto-marked blocks from today/yesterday that the user hasn't
          confirmed yet. Zero obligation — close anytime, assumed events
          still feed the engine at half weight. */}
      <FloatingFinishedPill
        blocks={blocks}
        tasks={tasks}
        onConfirm={confirmAutoMarked}
        onMarkSkipped={(id) => {
          markBlockSkipped(id);
          toast.success('Marked as skipped — engine has clean signal', { duration: 2500 });
        }}
      />

      {/* Weekly retrospective — opens via ⌘K or InsightsBanner footer */}
      <WeeklyRetrospectiveSheet
        open={retroOpen}
        onClose={() => setRetroOpen(false)}
        energy={insights.energy}
        capacity={insights.capacity}
        dayShape={insights.dayShape}
        missed={insights.missed}
        digest={insights.digest}
        onApplyEnergy={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated', { description: insights.energy.reason, duration: 4500 });
        }}
        onApplyCapacity={() => {
          applyLearnedCap();
          toast.success(`Daily cap set to ${insights.capacity.suggested_cap_hours}h`, {
            description: insights.capacity.reason,
            duration: 4500,
          });
        }}
        onJumpToTask={(id) => {
          const task = tasks.find(t => t.id === id);
          if (!task) return;
          setEditingTask(task);
          setSidebarOpen(true);
          setSidePanel('edit');
          setRetroOpen(false);
        }}
      />

      {/* Command palette — ⌘K to open */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        tasks={tasks}
        blocks={blocks}
        pendingExists={pendingResult !== null}
        canUndo={canUndo}
        atRiskCount={summary.atRiskTasks}
        droppedCount={summary.droppedTasks}
        todayMode={getDayMode(format(new Date(), 'yyyy-MM-dd'))}
        energyInsight={insights.energy}
        capacityInsight={insights.capacity}
        onApplyLearnedEnergy={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated', { description: insights.energy.reason, duration: 4500 });
        }}
        onApplyLearnedCapacity={() => {
          applyLearnedCap();
          toast.success(`Daily cap set to ${insights.capacity.suggested_cap_hours}h`, {
            description: insights.capacity.reason,
            duration: 4500,
          });
        }}
        onOpenRetrospective={() => setRetroOpen(true)}
        onPreviewRebuild={previewRebuild}
        onApplyPending={handleApply}
        onCancelPending={cancelPending}
        onUndo={() => {
          undo();
          toast.success('Reverted last schedule change');
        }}
        onReplanFromNow={() => {
          replanFromNow();
          toast.message('Replanning from now', {
            description: 'Past pending blocks cleared — preview opens with the new layout.',
            duration: 3500,
          });
        }}
        onSetTodayMode={(mode) => {
          const today = format(new Date(), 'yyyy-MM-dd');
          setDayMode(today, mode);
          toast.success(
            mode === 'easy'
              ? "Today's cap lowered — easy day"
              : mode === 'heavy'
              ? "Today's cap raised — heavy day"
              : "Today reset to normal cap",
            {
              description: 'Click Rebuild to see the schedule honor the new cap.',
              duration: 3500,
            }
          );
        }}
        onAddTask={() => {
          clearQuickAdd();
          setSidebarOpen(true);
          setSidePanel('add');
        }}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenIntegrations={() => setIntegrationsOpen(true)}
        onSwitchView={setCalendarView}
        onJumpToToday={() => {
          setSelectedDate(new Date());
          setCalendarView('day');
        }}
        onJumpToTask={(id) => {
          const task = tasks.find(t => t.id === id);
          if (!task) return;
          setEditingTask(task);
          setSidebarOpen(true);
          setSidePanel('edit');
        }}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
      />
    </div>
  );
};

export default Index;
