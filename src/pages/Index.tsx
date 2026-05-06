/**
 * axis — three-pane scheduler.
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ TopBar (◀ Today ▶ + view switcher + ⌘K + +Task)              │
 *   ├────────────┬─────────────────────────────────────────────────┤
 *   │ Sidebar    │                                                 │
 *   │ Right Now  │           Calendar (Day/Week/Month)             │
 *   │ Today      │           (Motion/Reclaim/Cron grid)            │
 *   │ Inbox      │                                                 │
 *   │ Due soon   │                                                 │
 *   └────────────┴─────────────────────────────────────────────────┘
 *
 * Pattern lineage:
 *   • Top bar — Cron / Notion Calendar (compact, keyboard-first).
 *   • Sidebar — Sunsama (Right Now + Today) × Things 3 (Inbox / Today
 *     / Due Soon sections with counts).
 *   • Calendar — Motion / Reclaim / Cron (traditional 7-column grid).
 *   • ⌘K command palette — Linear / Cron / Notion Calendar.
 *   • TaskEditSheet for both new + edit — Things 3 / Sunsama: one
 *     surface for both flows. No NL chatbox masquerading as AI; the
 *     deterministic regex composer was removed when the user pointed
 *     out (correctly) that it shouldn't pretend to be intelligent.
 *   • Right-slide sheets for Settings / Integrations / Insights —
 *     every modern productivity app.
 */

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useScheduler } from '@/hooks/useScheduler';
import { useExternalCalendars } from '@/hooks/useExternalCalendars';
import { Task } from '@/types/task';
import { summarizeRebuild } from '@/engine/diff';

import { TopBar } from '@/components/TopBar';
import { AxisSidebar } from '@/components/axis/AxisSidebar';
import { KeyboardCheatSheet } from '@/components/axis/KeyboardCheatSheet';
import { DayView } from '@/components/DayView';
import { WeekView } from '@/components/WeekView';
import { MonthView } from '@/components/MonthView';
import { CommandPalette } from '@/components/CommandPalette';
import { TaskEditSheet } from '@/components/TaskEditSheet';
import { TasksSheet } from '@/components/axis/TasksSheet';
import { SettingsSheet } from '@/components/SettingsSheet';
import { IntegrationsSheet } from '@/components/IntegrationsSheet';
import { WeeklyRetrospectiveSheet } from '@/components/WeeklyRetrospectiveSheet';
import { RebuildPreviewSheet } from '@/components/RebuildPreviewSheet';
import { FloatingFinishedPill } from '@/components/FloatingFinishedPill';
import { OnboardingFlow } from '@/components/OnboardingFlow';

type CalendarView = 'day' | 'week' | 'month';

const Index = () => {
  const {
    tasks,
    blocks,
    settings,
    summary,
    insights,
    addTask,
    updateTask,
    deleteTask,
    deleteBlock,
    moveBlock,
    resizeBlock,
    lockBlock,
    unlockBlock,
    rebuild,
    previewRebuild,
    applyPending,
    cancelPending,
    replanFromNow,
    pendingResult,
    pendingDiff,
    lastResult,
    undo,
    canUndo,
    markBlockDone,
    markBlockSkipped,
    confirmAutoMarked,
    setDayMode,
    getDayMode,
    applyLearnedDeepWindow,
    applyLearnedCap,
    updateSettings,
    importSyncedTasks,
    getDurationSuggestion,
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

  // Bring synced tasks into native AXIS storage on first sync
  useEffect(() => {
    if (syncedTasks.length > 0) importSyncedTasks(syncedTasks);
  }, [syncedTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 30s so the now-line and "right now" counters update
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Layout state — initial view + sidebar adapt to viewport.
  // Mobile (<768px) defaults to Day view (Week is unreadable on phones)
  // and sidebar closed (it'd cover the calendar).
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768;
  const [calendarView, setCalendarView] = useState<CalendarView>(() =>
    isMobile ? 'day' : 'week'
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);

  // Modal/sheet state
  const [paletteOpen, setPaletteOpen] = useState(false);
  // editingTask = null AND taskSheetOpen = true → "new task" mode.
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
  const [insightsSheetOpen, setInsightsSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);

  const openNewTask = () => {
    setEditingTask(null);
    setTaskSheetOpen(true);
  };
  const openEditTask = (t: Task) => {
    setEditingTask(t);
    setTaskSheetOpen(true);
  };
  const closeTaskSheet = () => {
    setTaskSheetOpen(false);
    setEditingTask(null);
  };

  // First-load auto-rebuild
  useEffect(() => {
    if (tasks.length > 0 && blocks.length === 0) rebuild({ silent: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface dropped/at-risk tasks as a toast after silent rebuilds
  const [lastResultId, setLastResultId] = useState<string | null>(null);
  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.computed_at === lastResultId) return;
    setLastResultId(lastResult.computed_at);
    if (lastResult.dropped.length > 0) {
      toast.error(
        `${lastResult.dropped.length} task${lastResult.dropped.length > 1 ? 's' : ''} couldn't fit`,
        {
          description: lastResult.dropped.slice(0, 2).map(d => d.task_title).join(', '),
          duration: 5500,
        }
      );
    } else if (lastResult.at_risk.length > 0) {
      toast.warning(
        `${lastResult.at_risk.length} task${lastResult.at_risk.length > 1 ? 's' : ''} at risk`,
        { duration: 4500 }
      );
    }
  }, [lastResult, lastResultId]);

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

      if (meta && key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (meta && key === 'n') {
        e.preventDefault();
        openNewTask();
        return;
      }
      if (meta && key === '\\') {
        e.preventDefault();
        setSidebarOpen(s => !s);
        return;
      }

      if (inField) return;

      // ? toggles the cheat sheet (Linear / Notion / Cron convention).
      // Use e.key === '?' rather than the lowered version because shift+/
      // produces '?' literally — matching is direct.
      if (e.key === '?') {
        e.preventDefault();
        setCheatSheetOpen(o => !o);
        return;
      }

      if (key === 'a') {
        e.preventDefault();
        openNewTask();
      } else if (key === 't') {
        e.preventDefault();
        setSelectedDate(new Date());
      } else if (key === '1') {
        setCalendarView('day');
      } else if (key === '2') {
        setCalendarView('week');
      } else if (key === '3') {
        setCalendarView('month');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleAddTask = (task: Task) => {
    addTask(task);
    setTimeout(() => rebuild({ silent: true }), 100);
  };
  const handleUpdateTask = (task: Task) => {
    updateTask(task.id, task);
    setEditingTask(null);
    setTimeout(() => rebuild({ silent: true }), 100);
  };
  /** Drag-from-sidebar drop handler — pins the dropped task to the
   *  chosen datetime by switching it to fixed scheduling mode. The
   *  engine's rebuild then respects that lock and routes other blocks
   *  around it. Sunsama / Motion / Reclaim manual-override path. */
  const handleDropTaskAt = (taskId: string, date: string, time: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const [hh, mm] = time.split(':').map(Number);
    const startMin = hh * 60 + mm;
    // Pinned tasks use their existing duration; fall back to 60min if
    // the task was a no-duration calendar import.
    const dur = task.total_duration > 0 ? task.total_duration : 60;
    const endMin = Math.min(24 * 60, startMin + dur);
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    const startIso = `${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
    const endIso = `${date}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
    updateTask(taskId, {
      ...task,
      scheduling_mode: 'fixed',
      start_datetime: startIso,
      end_datetime: endIso,
      total_duration: dur,
    });
    setTimeout(() => rebuild({ silent: true }), 50);
    toast.success(`Pinned "${task.title || 'Untitled'}" to ${time}`);
  };

  const handleDeleteTask = (id: string) => {
    deleteTask(id);
    setTimeout(() => rebuild({ silent: true }), 100);
  };
  /** Calendar empty-slot click — opens TaskEditSheet with a new task,
   *  pre-seeded as a fixed-time entry at the clicked slot. */
  const handleQuickAddFromCalendar = (date: string, time: string) => {
    const hh = time.slice(0, 5);
    const start = `${date}T${hh}:00`;
    // Default to a 60-minute block.
    const [h, m] = hh.split(':').map(Number);
    const endMin = Math.min(22 * 60, h * 60 + m + 60);
    const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
    const endM = String(endMin % 60).padStart(2, '0');
    const stub: Task = {
      id: `task-${Date.now()}`,
      title: '',
      description: undefined,
      color: undefined,
      total_duration: 60,
      priority: 3,
      deadline: null,
      energy_intensity: 'moderate',
      scheduling_mode: 'fixed',
      window_start: null,
      window_end: null,
      start_datetime: start,
      end_datetime: `${date}T${endH}:${endM}:00`,
      execution_style: 'single',
      is_recurring: false,
      recurrence_pattern: null,
      recurrence_interval: 1,
      recurrence_end: null,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    setEditingTask(stub);
    setTaskSheetOpen(true);
  };
  const handleApplyPreview = () => {
    if (!pendingResult || !pendingDiff) return;
    const summaryText = summarizeRebuild(pendingDiff, pendingResult);
    applyPending();
    toast.success('Schedule updated', { description: summaryText, duration: 4000 });
  };

  const hasInsights =
    insights.energy.shift_recommended ||
    insights.capacity.reduce_recommended ||
    insights.capacity.raise_recommended ||
    insights.missed.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top bar — global navigation surface */}
      <TopBar
        view={calendarView}
        selectedDate={selectedDate}
        hasInsights={hasInsights}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen(s => !s)}
        onViewChange={setCalendarView}
        onDateChange={setSelectedDate}
        onJumpToToday={() => setSelectedDate(new Date())}
        onOpenPalette={() => setPaletteOpen(true)}
        onAddTask={openNewTask}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRetrospective={() => setInsightsSheetOpen(true)}
      />

      {/* Three-pane body: sidebar + main calendar.
          Mobile (<768px) treats the sidebar as an overlay drawer with
          a backdrop, so it doesn't squish the calendar. Desktop keeps
          it inline. */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile-only backdrop when sidebar is open */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="md:hidden fixed inset-0 z-30 bg-background/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="
                shrink-0 overflow-hidden
                max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[280px] max-md:shadow-2xl
                md:relative md:w-[280px]
              "
            >
              <AxisSidebar
                tasks={tasks}
                blocks={blocks}
                now={now}
                selectedDate={selectedDate}
                onSelectDate={d => {
                  setSelectedDate(d);
                  // On mobile, close drawer after picking a date so the
                  // user lands on the calendar.
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setSidebarOpen(false);
                  }
                }}
                onTaskClick={openEditTask}
                onBlockComplete={id => {
                  markBlockDone(id, 'confirmed');
                  toast.success('Marked done');
                }}
                onBlockSkip={id => {
                  markBlockSkipped(id);
                  toast.success('Skipped');
                }}
                onOpenAllTasks={() => setTasksSheetOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main calendar surface */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {calendarView === 'day' && (
            <DayView
              blocks={blocks}
              tasks={tasks}
              settings={settings}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onMoveBlock={moveBlock}
              onResizeBlock={resizeBlock}
              onLockBlock={lockBlock}
              onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock}
              onQuickAdd={handleQuickAddFromCalendar}
              onEditTask={openEditTask}
              onDropTaskAt={handleDropTaskAt}
            />
          )}
          {calendarView === 'week' && (
            <WeekView
              blocks={blocks}
              tasks={tasks}
              settings={settings}
              onMoveBlock={moveBlock}
              onResizeBlock={resizeBlock}
              onLockBlock={lockBlock}
              onUnlockBlock={unlockBlock}
              onDeleteBlock={deleteBlock}
              onQuickAdd={handleQuickAddFromCalendar}
              onEditTask={openEditTask}
              onMarkDone={id => markBlockDone(id, 'confirmed')}
              onMarkSkipped={markBlockSkipped}
              onDropTaskAt={handleDropTaskAt}
            />
          )}
          {calendarView === 'month' && (
            <MonthView
              blocks={blocks}
              tasks={tasks}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onDayClick={d => {
                setSelectedDate(d);
                setCalendarView('day');
              }}
            />
          )}
        </main>
      </div>

      {/* ─── Modals & sheets ─── */}
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
        onPreviewRebuild={previewRebuild}
        onApplyPending={handleApplyPreview}
        onCancelPending={cancelPending}
        onUndo={undo}
        onReplanFromNow={replanFromNow}
        onSetTodayMode={mode => setDayMode(format(new Date(), 'yyyy-MM-dd'), mode)}
        onApplyLearnedEnergy={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated');
        }}
        onApplyLearnedCapacity={() => {
          applyLearnedCap();
          toast.success(`Daily cap set to ${insights.capacity.suggested_cap_hours}h`);
        }}
        onOpenRetrospective={() => setInsightsSheetOpen(true)}
        onAddTask={openNewTask}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenIntegrations={() => setIntegrationsOpen(true)}
        onSwitchView={setCalendarView}
        onJumpToToday={() => setSelectedDate(new Date())}
        onJumpToTask={id => {
          const task = tasks.find(t => t.id === id);
          if (task) openEditTask(task);
        }}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
      />

      {/* TaskEditSheet — handles BOTH new (task=null) and edit (task=Task).
          One surface for both flows; Things 3 / Sunsama pattern. */}
      <TaskEditSheet
        open={taskSheetOpen}
        task={editingTask}
        existingBlocks={blocks}
        existingTasks={tasks}
        onClose={closeTaskSheet}
        onSubmit={t => {
          if (editingTask) {
            handleUpdateTask(t);
          } else {
            handleAddTask(t);
            toast.success(`"${t.title || 'Untitled task'}" added`, { duration: 2500 });
          }
          closeTaskSheet();
        }}
        getDurationSuggestion={getDurationSuggestion}
      />

      <TasksSheet
        open={tasksSheetOpen}
        onClose={() => setTasksSheetOpen(false)}
        tasks={tasks}
        onUpdate={t => {
          updateTask(t.id, t);
          setTimeout(() => rebuild({ silent: true }), 50);
          toast.success('Task updated');
        }}
        onDelete={id => {
          deleteTask(id);
          setTimeout(() => rebuild({ silent: true }), 50);
          toast.success('Task deleted');
        }}
        onFocusComposer={() => {
          setTasksSheetOpen(false);
          openNewTask();
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        energyInsight={insights.energy}
        onUpdate={updateSettings}
        onApplyLearnedDeepWindow={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated');
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

      <WeeklyRetrospectiveSheet
        open={insightsSheetOpen}
        onClose={() => setInsightsSheetOpen(false)}
        energy={insights.energy}
        capacity={insights.capacity}
        dayShape={insights.dayShape}
        missed={insights.missed}
        digest={insights.digest}
        onApplyEnergy={() => {
          applyLearnedDeepWindow();
          toast.success('Deep window updated');
        }}
        onApplyCapacity={() => {
          applyLearnedCap();
          toast.success(
            `Daily cap set to ${insights.capacity.suggested_cap_hours}h`
          );
        }}
        onJumpToTask={id => {
          const task = tasks.find(t => t.id === id);
          if (!task) return;
          openEditTask(task);
          setInsightsSheetOpen(false);
        }}
      />

      <RebuildPreviewSheet
        open={pendingResult !== null}
        result={pendingResult}
        diff={pendingDiff}
        tasks={tasks}
        onApply={handleApplyPreview}
        onCancel={cancelPending}
      />

      <FloatingFinishedPill
        blocks={blocks}
        tasks={tasks}
        onConfirm={confirmAutoMarked}
        onMarkSkipped={markBlockSkipped}
      />

      <KeyboardCheatSheet
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
      />

      <OnboardingFlow
        hasNoTasks={tasks.length === 0}
        hasNoHistory={
          (insights.energy.sample_size ?? 0) === 0 && summary.placedBlocks === 0
        }
        settings={settings}
        onUpdateSettings={updateSettings}
        onAddSampleTask={partial => {
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
        }}
      />
    </div>
  );
};

export default Index;
