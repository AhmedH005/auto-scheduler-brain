/**
 * CommandPalette — ⌘K to open. Power-user shortcut surface.
 *
 * Borrows the Linear / Raycast / Superhuman pattern: every action that has
 * a button somewhere in the app is also reachable here, plus a few
 * keyboard-only shortcuts (jump to today, show at-risk, etc.).
 *
 * Why a command palette: GOMS-KLM keystroke modeling consistently shows
 * keyboard pathways outperform mouse pathways once a user is past the
 * "first 10 sessions" learning curve. For a daily-use tool this is the
 * single highest-leverage UX investment.
 */

import { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  LayoutGrid,
  Plus,
  RefreshCw,
  Undo2,
  Settings,
  Network,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Search,
  Sparkles,
  X,
  Coffee,
  Flame,
  RotateCcw,
  FastForward,
  Sunrise,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Task, ScheduledBlock, EnergySuggestion, CapacitySuggestion } from '@/types/task';
import { format } from 'date-fns';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Contextual state
  tasks: Task[];
  blocks: ScheduledBlock[];
  pendingExists: boolean;
  canUndo: boolean;
  atRiskCount: number;
  droppedCount: number;
  todayMode: 'easy' | 'normal' | 'heavy';
  energyInsight: EnergySuggestion;
  capacityInsight: CapacitySuggestion;
  // Actions
  onPreviewRebuild: () => void;
  onApplyPending: () => void;
  onCancelPending: () => void;
  onUndo: () => void;
  onReplanFromNow: () => void;
  onSetTodayMode: (mode: 'easy' | 'normal' | 'heavy') => void;
  onApplyLearnedEnergy: () => void;
  onApplyLearnedCapacity: () => void;
  onOpenRetrospective: () => void;
  onAddTask: () => void;
  onOpenSettings: () => void;
  onOpenIntegrations: () => void;
  onSwitchView: (view: 'day' | 'week' | 'month') => void;
  onJumpToToday: () => void;
  onJumpToTask: (taskId: string) => void;
  onToggleSidebar: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  blocks,
  pendingExists,
  canUndo,
  atRiskCount,
  droppedCount,
  todayMode,
  energyInsight,
  capacityInsight,
  onPreviewRebuild,
  onApplyPending,
  onCancelPending,
  onUndo,
  onReplanFromNow,
  onSetTodayMode,
  onApplyLearnedEnergy,
  onApplyLearnedCapacity,
  onOpenRetrospective,
  onAddTask,
  onOpenSettings,
  onOpenIntegrations,
  onSwitchView,
  onJumpToToday,
  onJumpToTask,
  onToggleSidebar,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');

  // Reset search every time we open
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  // Helper: run a command and close
  const run = (fn: () => void) => () => {
    fn();
    onOpenChange(false);
  };

  // Searchable active tasks
  const activeTasks = useMemo(
    () => tasks.filter(t => t.status === 'active').slice(0, 50),
    [tasks]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed left-1/2 top-[15vh] z-[81] -translate-x-1/2 w-[92vw] max-w-[600px]"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <Command
              className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              filter={(value, search, keywords) => {
                const haystack = (value + ' ' + (keywords?.join(' ') ?? '')).toLowerCase();
                return haystack.includes(search.toLowerCase()) ? 1 : 0;
              }}
              shouldFilter={true}
            >
              {/* Input */}
              <div className="flex items-center gap-2 px-4 border-b border-border bg-card/95">
                <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search commands or tasks…"
                  className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none font-mono"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground/45 px-1.5 py-0.5 rounded border border-border bg-secondary/50">
                  esc
                </kbd>
                <button
                  onClick={() => onOpenChange(false)}
                  className="sm:hidden text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-xs font-mono text-muted-foreground/60">
                  No matches. Try "rebuild" or a task name.
                </Command.Empty>

                {/* Schedule actions */}
                <CommandGroup heading="Schedule">
                  <CommandItem
                    icon={RefreshCw}
                    label="Rebuild schedule"
                    description="Show preview of proposed changes"
                    keywords={['rebuild', 'reschedule', 'replan', 'preview']}
                    shortcut={<Kbd>R</Kbd>}
                    onSelect={run(onPreviewRebuild)}
                  />

                  <CommandItem
                    icon={FastForward}
                    label="Replan from now"
                    description="Something came up — push pending blocks forward"
                    keywords={['replan', 'now', 'push', 'forward', 'interrupt', 'tired', 'spontaneous', 'late']}
                    onSelect={run(onReplanFromNow)}
                  />

                  {pendingExists && (
                    <>
                      <CommandItem
                        icon={CheckCircle2}
                        label="Apply pending changes"
                        description="Commit the proposed schedule"
                        keywords={['apply', 'commit', 'accept']}
                        tone="green"
                        onSelect={run(onApplyPending)}
                      />
                      <CommandItem
                        icon={X}
                        label="Cancel preview"
                        description="Discard proposed changes"
                        keywords={['cancel', 'discard']}
                        onSelect={run(onCancelPending)}
                      />
                    </>
                  )}

                  {canUndo && (
                    <CommandItem
                      icon={Undo2}
                      label="Undo last change"
                      description="Revert the last reschedule"
                      keywords={['undo', 'revert', 'back']}
                      shortcut={
                        <>
                          <Kbd>⌘</Kbd>
                          <Kbd>Z</Kbd>
                        </>
                      }
                      onSelect={run(onUndo)}
                    />
                  )}

                  {/* Day mode — for "I'm tired" or "I'm crushing it" days */}
                  {todayMode !== 'easy' && (
                    <CommandItem
                      icon={Coffee}
                      label="Easy day — lighten today's load"
                      description="Halve today's daily cap. I'm tired or have something on."
                      keywords={['easy', 'tired', 'light', 'rest', 'low', 'today']}
                      tone="amber"
                      onSelect={run(() => onSetTodayMode('easy'))}
                    />
                  )}
                  {todayMode !== 'heavy' && (
                    <CommandItem
                      icon={Flame}
                      label="Heavy day — push today's cap"
                      description="Raise today's daily cap by 50%. I have time and energy."
                      keywords={['heavy', 'crush', 'high', 'sprint', 'today']}
                      onSelect={run(() => onSetTodayMode('heavy'))}
                    />
                  )}
                  {todayMode !== 'normal' && (
                    <CommandItem
                      icon={RotateCcw}
                      label={`Reset today to normal (currently: ${todayMode})`}
                      description="Clear today's cap override"
                      keywords={['normal', 'reset', 'default', 'today']}
                      onSelect={run(() => onSetTodayMode('normal'))}
                    />
                  )}

                  {droppedCount > 0 && (
                    <CommandItem
                      icon={AlertOctagon}
                      label={`${droppedCount} task${droppedCount > 1 ? 's' : ''} couldn't fit — review`}
                      description="Open preview to see what got dropped"
                      keywords={['dropped', 'overflow', 'overcommit', 'risk']}
                      tone="red"
                      onSelect={run(onPreviewRebuild)}
                    />
                  )}

                  {atRiskCount > 0 && (
                    <CommandItem
                      icon={AlertTriangle}
                      label={`${atRiskCount} at risk near deadline — review`}
                      description="Open preview to see at-risk tasks"
                      keywords={['risk', 'deadline', 'tight', 'late']}
                      tone="amber"
                      onSelect={run(onPreviewRebuild)}
                    />
                  )}
                </CommandGroup>

                {/* Learning insights — only render when there's actionable signal */}
                {(energyInsight.shift_recommended ||
                  capacityInsight.reduce_recommended ||
                  capacityInsight.raise_recommended) && (
                  <CommandGroup heading="Learned about you">
                    {energyInsight.shift_recommended && (
                      <CommandItem
                        icon={Sunrise}
                        label={`Apply learned deep window (${pad(energyInsight.suggested_start_hour)}:00–${pad(energyInsight.suggested_end_hour)}:00)`}
                        description={energyInsight.reason}
                        keywords={['energy', 'window', 'deep', 'peak', 'morning', 'curve', 'apply']}
                        tone="green"
                        onSelect={run(onApplyLearnedEnergy)}
                      />
                    )}
                    {capacityInsight.reduce_recommended && (
                      <CommandItem
                        icon={TrendingDown}
                        label={`Lower daily cap to ${capacityInsight.suggested_cap_hours}h`}
                        description={capacityInsight.reason}
                        keywords={['cap', 'lower', 'capacity', 'reduce', 'easier']}
                        tone="amber"
                        onSelect={run(onApplyLearnedCapacity)}
                      />
                    )}
                    {capacityInsight.raise_recommended && (
                      <CommandItem
                        icon={TrendingUp}
                        label={`Raise daily cap to ${capacityInsight.suggested_cap_hours}h`}
                        description={capacityInsight.reason}
                        keywords={['cap', 'raise', 'capacity', 'increase', 'more']}
                        tone="green"
                        onSelect={run(onApplyLearnedCapacity)}
                      />
                    )}
                  </CommandGroup>
                )}

                <CommandGroup heading="Reflect">
                  <CommandItem
                    icon={Sparkles}
                    label="Weekly retrospective"
                    description="See what the system learned about you this week"
                    keywords={['retrospective', 'weekly', 'review', 'insights', 'patterns', 'reflection']}
                    onSelect={run(onOpenRetrospective)}
                  />
                </CommandGroup>

                {/* Task actions */}
                <CommandGroup heading="Tasks">
                  <CommandItem
                    icon={Plus}
                    label="Add a task"
                    description="Open the task form"
                    keywords={['add', 'new', 'task', 'create']}
                    shortcut={<Kbd>A</Kbd>}
                    onSelect={run(onAddTask)}
                  />
                </CommandGroup>

                {/* Active tasks (jump to) */}
                {activeTasks.length > 0 && search.length > 0 && (
                  <CommandGroup heading="Jump to task">
                    {activeTasks.slice(0, 8).map(task => (
                      <CommandItem
                        key={task.id}
                        icon={taskIconForMode(task.scheduling_mode)}
                        label={task.title}
                        description={taskDescription(task)}
                        keywords={['task', 'jump', task.scheduling_mode, task.energy_intensity]}
                        onSelect={run(() => onJumpToTask(task.id))}
                      />
                    ))}
                  </CommandGroup>
                )}

                {/* View switcher */}
                <CommandGroup heading="View">
                  <CommandItem
                    icon={CalendarDays}
                    label="Day view"
                    keywords={['day', 'view', 'today']}
                    shortcut={<Kbd>1</Kbd>}
                    onSelect={run(() => onSwitchView('day'))}
                  />
                  <CommandItem
                    icon={CalendarIcon}
                    label="Week view"
                    keywords={['week', 'view']}
                    shortcut={<Kbd>2</Kbd>}
                    onSelect={run(() => onSwitchView('week'))}
                  />
                  <CommandItem
                    icon={LayoutGrid}
                    label="Month view"
                    keywords={['month', 'view']}
                    shortcut={<Kbd>3</Kbd>}
                    onSelect={run(() => onSwitchView('month'))}
                  />
                  <CommandItem
                    icon={Clock}
                    label="Jump to today"
                    keywords={['today', 'now', 'jump']}
                    shortcut={<Kbd>T</Kbd>}
                    onSelect={run(onJumpToToday)}
                  />
                </CommandGroup>

                {/* App */}
                <CommandGroup heading="Settings">
                  <CommandItem
                    icon={Settings}
                    label="Open settings"
                    keywords={['settings', 'config', 'preferences']}
                    onSelect={run(onOpenSettings)}
                  />
                  <CommandItem
                    icon={Network}
                    label="Calendar integrations"
                    description="Google Calendar sync"
                    keywords={['google', 'calendar', 'sync', 'integrations']}
                    onSelect={run(onOpenIntegrations)}
                  />
                  <CommandItem
                    icon={Sparkles}
                    label="Toggle sidebar"
                    keywords={['sidebar', 'toggle', 'fullscreen']}
                    onSelect={run(onToggleSidebar)}
                  />
                </CommandGroup>
              </Command.List>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-border flex items-center gap-3 text-[10px] font-mono text-muted-foreground/55">
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>esc</Kbd>
                  close
                </span>
                <span className="ml-auto opacity-60">AXIS · ⌘K</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Subcomponents
// ─────────────────────────────────────────────────────────────────────────

const toneClasses: Record<string, string> = {
  default: 'text-foreground',
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

function CommandGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/45"
    >
      {children}
    </Command.Group>
  );
}

function CommandItem({
  icon: Icon,
  label,
  description,
  keywords,
  shortcut,
  tone = 'default',
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  keywords?: string[];
  shortcut?: React.ReactNode;
  tone?: keyof typeof toneClasses;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      keywords={keywords}
      onSelect={onSelect}
      className="flex items-center gap-3 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors aria-selected:bg-secondary/80 hover:bg-secondary/40"
    >
      <Icon className={`w-4 h-4 shrink-0 ${toneClasses[tone]}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] truncate ${toneClasses[tone]}`}>{label}</p>
        {description && (
          <p className="text-[10px] text-muted-foreground/55 truncate font-mono">{description}</p>
        )}
      </div>
      {shortcut && (
        <span className="flex items-center gap-1 shrink-0 opacity-70">{shortcut}</span>
      )}
    </Command.Item>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-mono text-muted-foreground/70 px-1 rounded border border-border bg-secondary/40">
      {children}
    </kbd>
  );
}

function taskIconForMode(mode: Task['scheduling_mode']) {
  switch (mode) {
    case 'fixed':
      return CalendarIcon;
    case 'anchor':
      return Clock;
    case 'flexible':
    default:
      return CheckCircle2;
  }
}

function taskDescription(task: Task): string {
  const parts: string[] = [];
  parts.push(`${task.total_duration}m`);
  parts.push(task.energy_intensity);
  if (task.deadline) parts.push(`due ${format(new Date(task.deadline), 'MMM d')}`);
  return parts.join(' · ');
}

const pad = (n: number) => String(n).padStart(2, '0');
