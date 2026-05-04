/**
 * axis — the conversation-first scheduler.
 *
 * One surface. No tabs. No sidebars. No modals. No forms.
 *
 * Top → bottom:
 *   1. Header — date, theme toggle, settings dot. Minimal.
 *   2. Week ribbon — this week at a glance, 7 thin columns.
 *   3. Now card — what you're on right now (or what's next).
 *   4. Upcoming flow — vertical river of the next 12 hours.
 *   5. Assistant bar — persistent composer at the bottom. The spine.
 *
 * Every action flows through the assistant. Direct manipulation
 * (the now card buttons, tapping a block in the flow) handles the
 * 95% case fast. The composer handles the 5% — moves, queries, replans,
 * day-shape changes, undo, anything novel.
 *
 * Why this shape vs. a calendar grid:
 *   - 80% of "what should I do" questions are about the next few hours,
 *     not the next 7 days. The grid optimizes for the wrong question.
 *   - Forms force users to think in fields. Conversations let users
 *     think in intents. Intent → fields is the engine's job.
 *   - One surface, top-to-bottom, is the entire mobile-first internet.
 *     We don't fight that with a desktop-grid mental model.
 *
 * The engine is unchanged. This is the new face.
 */

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useScheduler } from '@/hooks/useScheduler';
import { useExternalCalendars } from '@/hooks/useExternalCalendars';
import { Task, ScheduledBlock } from '@/types/task';
import { interpret } from '@/engine/assistant';
import { parsedTaskToTask } from '@/engine/quickadd-parser';
import { WeekRibbon } from '@/components/axis/WeekRibbon';
import { NowCard } from '@/components/axis/NowCard';
import { UpcomingFlow } from '@/components/axis/UpcomingFlow';
import { AssistantBar, type ThreadTurn } from '@/components/axis/AssistantBar';
import { SettingsSheet } from '@/components/SettingsSheet';
import { IntegrationsSheet } from '@/components/IntegrationsSheet';
import { Settings, Sun, Moon, Sparkles } from 'lucide-react';

const Index = () => {
  const {
    tasks,
    blocks,
    settings,
    addTask,
    deleteTask,
    deleteBlock,
    rebuild,
    undo,
    canUndo,
    pendingResult,
    applyPending,
    markBlockDone,
    markBlockSkipped,
    setDayMode,
    insights,
    applyLearnedDeepWindow,
    updateSettings,
    importSyncedTasks,
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

  // Bring synced tasks into native AXIS storage
  useEffect(() => {
    if (syncedTasks.length > 0) importSyncedTasks(syncedTasks);
  }, [syncedTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 30s so "now" updates and the now-line moves
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [thread, setThread] = useState<ThreadTurn[]>(() => [
    {
      from: 'axis',
      text: 'hi. tell me what you want to do — or what just happened.',
      at: Date.now(),
    },
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('axis_theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    if (theme === 'light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
    localStorage.setItem('axis_theme', theme);
  }, [theme]);

  // First-load auto-rebuild — silent (no preview interruption)
  useEffect(() => {
    if (tasks.length > 0 && blocks.length === 0) rebuild({ silent: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply silent rebuilds — the user never sees a "preview/apply" gate
  // in conversational mode. axis just decides and tells you.
  useEffect(() => {
    if (pendingResult) applyPending();
  }, [pendingResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [blocks]
  );

  const currentBlock = useMemo(() => {
    return sortedBlocks.find(b => {
      const s = new Date(b.start_time);
      const e = new Date(b.end_time);
      return s <= now && now < e && !b.completed_at;
    });
  }, [sortedBlocks, now]);

  const nextBlock = useMemo(() => {
    return sortedBlocks.find(
      b => new Date(b.start_time) > now && !b.completed_at
    );
  }, [sortedBlocks, now]);

  const focusBlock = currentBlock ?? nextBlock ?? null;
  const focusTask = useMemo(
    () =>
      focusBlock ? tasks.find(t => t.id === focusBlock.task_id) ?? null : null,
    [focusBlock, tasks]
  );

  const findBlockByQuery = (q: string): ScheduledBlock | undefined => {
    const ql = q.toLowerCase().trim();
    return sortedBlocks
      .filter(b => !b.completed_at)
      .find(b => {
        const tt = tasks.find(t => t.id === b.task_id);
        return tt && tt.title.toLowerCase().includes(ql);
      });
  };

  const pushAxis = (text: string) =>
    setThread(prev => [...prev, { from: 'axis', text, at: Date.now() }]);

  const handleSubmit = (input: string) => {
    setThread(prev => [...prev, { from: 'user', text: input, at: Date.now() }]);

    const turn = interpret(input, now);
    let speech = turn.speech;

    switch (turn.intent.kind) {
      case 'add': {
        const partial = parsedTaskToTask(turn.intent.task);
        const newTask: Task = {
          id: `task-${Date.now()}`,
          ...partial,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        addTask(newTask);
        setTimeout(() => rebuild({ silent: true }), 50);
        break;
      }
      case 'complete': {
        const b = findBlockByQuery(turn.intent.query);
        if (b) markBlockDone(b.id, 'confirmed');
        else
          speech = `Couldn't find a block matching "${turn.intent.query}". Try a different word from the title.`;
        break;
      }
      case 'skip': {
        const b = findBlockByQuery(turn.intent.query);
        if (b) markBlockSkipped(b.id);
        else speech = `Couldn't find a block matching "${turn.intent.query}".`;
        break;
      }
      case 'delete': {
        const ql = turn.intent.query.toLowerCase().trim();
        const target = tasks.find(t => t.title.toLowerCase().includes(ql));
        if (target) {
          deleteTask(target.id);
          setTimeout(() => rebuild({ silent: true }), 50);
        } else {
          speech = `Couldn't find a task matching "${turn.intent.query}".`;
        }
        break;
      }
      case 'replan': {
        rebuild({ silent: true });
        break;
      }
      case 'undo': {
        if (canUndo) undo();
        else speech = 'Nothing to undo.';
        break;
      }
      case 'ease': {
        const today = format(now, 'yyyy-MM-dd');
        setDayMode(today, 'easy');
        setTimeout(() => rebuild({ silent: true }), 50);
        break;
      }
      case 'push': {
        const today = format(now, 'yyyy-MM-dd');
        setDayMode(today, 'heavy');
        setTimeout(() => rebuild({ silent: true }), 50);
        break;
      }
      case 'query_now': {
        if (currentBlock) {
          const t = tasks.find(x => x.id === currentBlock.task_id);
          speech = t
            ? `Right now: ${t.title}, until ${format(new Date(currentBlock.end_time), 'HH:mm')}.`
            : `On a block — but the task record is missing.`;
        } else if (nextBlock) {
          const t = tasks.find(x => x.id === nextBlock.task_id);
          speech = t
            ? `Nothing this minute. Next is ${t.title} at ${format(new Date(nextBlock.start_time), 'HH:mm')}.`
            : `Nothing this minute.`;
        } else {
          speech = `Nothing scheduled. Want me to start something?`;
        }
        break;
      }
      case 'query_next': {
        if (nextBlock) {
          const t = tasks.find(x => x.id === nextBlock.task_id);
          speech = t
            ? `Next: ${t.title} at ${format(new Date(nextBlock.start_time), 'HH:mm')}.`
            : `Next block exists but task record is missing.`;
        } else {
          speech = `Nothing scheduled next today.`;
        }
        break;
      }
      case 'query_today': {
        const today = format(now, 'yyyy-MM-dd');
        const todayBlocks = sortedBlocks.filter(b => b.start_time.startsWith(today));
        const remaining = todayBlocks.filter(b => new Date(b.end_time) > now);
        speech =
          todayBlocks.length === 0
            ? `Nothing scheduled today.`
            : `${todayBlocks.length} block${todayBlocks.length === 1 ? '' : 's'} today, ${remaining.length} still ahead. The flow below shows the shape.`;
        break;
      }
      case 'query_week': {
        const weekCount = blocks.length;
        speech = `${weekCount} block${weekCount === 1 ? '' : 's'} this week. The ribbon at the top shows where they sit.`;
        break;
      }
      case 'unknown':
        // speech is already set by interpret()
        break;
    }

    if (speech) pushAxis(speech);
  };

  const clearThread = () => {
    setThread([
      {
        from: 'axis',
        text: 'cleared. what next?',
        at: Date.now(),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — minimal. Brand + date on the left, two action dots on the right. */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-display text-foreground tracking-tight leading-none">
              axis
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/55 mt-0.5 tabular-nums">
              {format(now, 'EEEE · MMM d · HH:mm')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main scroll — 3 stacked surfaces, max 2xl wide centered */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-5 pb-44 space-y-3.5">
        <WeekRibbon
          blocks={blocks}
          tasks={tasks}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <NowCard
          block={focusBlock}
          task={focusTask}
          isCurrent={!!currentBlock && focusBlock?.id === currentBlock.id}
          onComplete={id => {
            markBlockDone(id, 'confirmed');
            pushAxis('Marked done. Recomputing.');
            toast.success('Done — clean signal');
          }}
          onSkip={id => {
            markBlockSkipped(id);
            pushAxis('Skipped. Engine knows.');
            toast.success('Skipped');
          }}
          onPostpone={id => {
            // Drop the block; the engine replaces it on the next rebuild.
            deleteBlock(id);
            setTimeout(() => rebuild({ silent: true }), 50);
            pushAxis('Postponed. Replanning around it.');
            toast.success('Postponed');
          }}
        />

        <UpcomingFlow
          blocks={blocks}
          tasks={tasks}
          now={now}
          onTapBlock={b => {
            const t = tasks.find(x => x.id === b.task_id);
            if (!t) return;
            const firstWord = t.title.split(/\s+/)[0];
            pushAxis(
              `${t.title} · ${format(new Date(b.start_time), 'HH:mm')} for ${t.total_duration}m. Say "I finished ${firstWord}", "skip ${firstWord}", or "delete ${firstWord}".`
            );
          }}
        />
      </main>

      {/* The spine — always-on composer */}
      <AssistantBar
        thread={thread}
        onSubmit={handleSubmit}
        onClearThread={clearThread}
      />

      {/* Settings + integrations as right-slide sheets — accessible from
          the header dot. Will eventually be triggerable via the assistant
          ("show settings", "connect google"). Until then, the dot. */}
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
    </div>
  );
};

export default Index;
