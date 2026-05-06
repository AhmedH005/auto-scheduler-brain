/**
 * AxisSidebar — left rail with the four sections users actually scan.
 *
 * Pattern lineage:
 *   • Sunsama: "Right Now" + "Today" focus blocks at top.
 *   • Things 3: Inbox / Today / Upcoming organization.
 *   • Motion: due-soon urgency surfacing.
 *   • Linear: counts in section headers, click row to drill in.
 *
 * Sections (top to bottom — fixed order users learn once):
 *   1. RIGHT NOW   — the current/next block in mini form. Done/Skip actions.
 *   2. TODAY       — tasks due today + tasks already scheduled today.
 *   3. INBOX       — active tasks without an immediate due date.
 *   4. DUE SOON    — next 7 days, sorted by date. Color-coded urgency.
 *
 * "All tasks" footer button opens the full TasksSheet inventory.
 */

import { useMemo } from 'react';
import { format, differenceInCalendarDays, differenceInMinutes } from 'date-fns';
import {
  Check,
  SkipForward,
  Clock,
  Calendar,
  Inbox,
  Flame,
  CheckCircle2,
  ListTodo,
  Repeat,
  Pin,
  Shield,
  AlertOctagon,
} from 'lucide-react';
import { Task, ScheduledBlock } from '@/types/task';
import { calculateScore } from '@/engine/scoring';
import { getTaskColor } from '@/lib/taskColors';
import { MiniMonth } from '@/components/axis/MiniMonth';

interface AxisSidebarProps {
  tasks: Task[];
  blocks: ScheduledBlock[];
  now: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onTaskClick: (task: Task) => void;
  onBlockComplete: (id: string) => void;
  onBlockSkip: (id: string) => void;
  onOpenAllTasks: () => void;
}

export function AxisSidebar({
  tasks,
  blocks,
  now,
  selectedDate,
  onSelectDate,
  onTaskClick,
  onBlockComplete,
  onBlockSkip,
  onOpenAllTasks,
}: AxisSidebarProps) {
  const today = format(now, 'yyyy-MM-dd');

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [blocks]
  );

  const currentBlock = useMemo(
    () =>
      sortedBlocks.find(b => {
        const s = new Date(b.start_time);
        const e = new Date(b.end_time);
        return s <= now && now < e && !b.completed_at;
      }),
    [sortedBlocks, now]
  );
  const nextBlock = useMemo(
    () =>
      sortedBlocks.find(
        b => new Date(b.start_time) > now && !b.completed_at
      ),
    [sortedBlocks, now]
  );
  const focusBlock = currentBlock ?? nextBlock ?? null;
  const focusTask = useMemo(
    () => focusBlock ? tasks.find(t => t.id === focusBlock.task_id) ?? null : null,
    [focusBlock, tasks]
  );

  // Today: any active task either due today, scheduled today, or has a
  // block on it today (irrespective of deadline).
  const todayTasks = useMemo(() => {
    const scheduledToday = new Set(
      blocks
        .filter(b => b.start_time.startsWith(today) && !b.completed_at)
        .map(b => b.task_id)
    );
    return tasks
      .filter(
        t =>
          t.status === 'active' &&
          (t.deadline === today || scheduledToday.has(t.id))
      )
      .sort((a, b) => calculateScore(b) - calculateScore(a));
  }, [tasks, blocks, today]);

  const todayIds = new Set(todayTasks.map(t => t.id));

  // Inbox = active backlog not already in Today. Recurring tasks count
  // (e.g. "Daily standup") so the user can still tap to edit them; the
  // ↻ icon disambiguates them visually. Cap at 10 for visual stability —
  // anything beyond that lives in the All Tasks sheet.
  const inboxTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'active' && !todayIds.has(t.id))
      .sort((a, b) => calculateScore(b) - calculateScore(a))
      .slice(0, 10);
  }, [tasks, todayIds]);

  const dueSoon = useMemo(() => {
    return tasks
      .filter(t => {
        if (t.status !== 'active' || !t.deadline) return false;
        const days = differenceInCalendarDays(new Date(t.deadline), now);
        return days >= -1 && days <= 7;
      })
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
      .slice(0, 6);
  }, [tasks, now]);

  return (
    <aside className="h-full flex flex-col bg-card/50 border-r border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* MINI MONTH — fast date jump (Cron / Apple Calendar pattern) */}
        <MiniMonth
          selectedDate={selectedDate}
          blocks={blocks}
          onSelectDate={onSelectDate}
        />

        {/* RIGHT NOW */}
        <NowSection
          block={focusBlock}
          task={focusTask}
          isCurrent={!!currentBlock}
          now={now}
          onComplete={onBlockComplete}
          onSkip={onBlockSkip}
        />

        {/* TODAY */}
        <Section
          title="Today"
          icon={ListTodo}
          count={todayTasks.length}
        >
          {todayTasks.length === 0 ? (
            <EmptyHint text="No tasks for today yet" />
          ) : (
            todayTasks.map(t => (
              <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />
            ))
          )}
        </Section>

        {/* INBOX */}
        <Section
          title="Inbox"
          icon={Inbox}
          count={inboxTasks.length}
        >
          {inboxTasks.length === 0 ? (
            <EmptyHint text="Inbox is clear" />
          ) : (
            inboxTasks.map(t => (
              <TaskRow key={t.id} task={t} onClick={() => onTaskClick(t)} />
            ))
          )}
        </Section>

        {/* DUE SOON */}
        {dueSoon.length > 0 && (
          <Section title="Due soon" icon={Calendar} count={dueSoon.length}>
            {dueSoon.map(t => {
              const days = differenceInCalendarDays(
                new Date(t.deadline!),
                now
              );
              return (
                <DeadlineRow
                  key={t.id}
                  task={t}
                  days={days}
                  onClick={() => onTaskClick(t)}
                />
              );
            })}
          </Section>
        )}
      </div>

      {/* Footer — all-tasks button (Things 3 footer pattern) */}
      <div className="shrink-0 px-2 py-2 border-t border-border/60">
        <button
          onClick={onOpenAllTasks}
          className="w-full flex items-center justify-between gap-2 px-3 h-8 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ListTodo className="w-3 h-3" />
            All tasks
          </span>
          <span className="text-[9px] font-mono tabular-nums text-muted-foreground/55">
            {tasks.filter(t => t.status === 'active').length}
          </span>
        </button>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Now section — compact "current/next block" with two actions
// ─────────────────────────────────────────────────────────────────────────

function NowSection({
  block,
  task,
  isCurrent,
  now,
  onComplete,
  onSkip,
}: {
  block: ScheduledBlock | null;
  task: Task | null;
  isCurrent: boolean;
  now: Date;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  if (!block || !task) {
    return (
      <div className="px-3 py-3 rounded-lg bg-secondary/25">
        <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/55 mb-1">
          right now
        </div>
        <div className="text-body text-muted-foreground/65">
          Nothing on the clock
        </div>
      </div>
    );
  }

  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const total = Math.max(1, differenceInMinutes(end, start));
  const remaining = isCurrent
    ? Math.max(0, differenceInMinutes(end, now))
    : total;
  const elapsed = total - remaining;
  const pct = isCurrent ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  const color = getTaskColor(task.color ?? task.calendar_color);

  return (
    <div
      className="px-3 py-2.5 rounded-lg overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${color.bg}66, hsl(var(--secondary) / 0.3))`,
        boxShadow: isCurrent
          ? `inset 2px 0 0 ${color.border}`
          : `inset 2px 0 0 ${color.border}66`,
      }}
    >
      <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/65 mb-1 flex items-center justify-between">
        <span>{isCurrent ? 'right now' : 'up next'}</span>
        <span className="tabular-nums">
          {isCurrent ? `${remaining}m left` : format(start, 'HH:mm')}
        </span>
      </div>
      <div className="text-body font-medium text-foreground leading-snug truncate mb-2">
        {task.title}
      </div>
      {isCurrent && (
        <div className="h-1 rounded-full bg-secondary/60 mb-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color.border }}
          />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onComplete(block.id)}
          className="flex-1 inline-flex items-center justify-center gap-1 h-7 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:brightness-110 transition-all"
        >
          <Check className="w-3 h-3" /> done
        </button>
        <button
          onClick={() => onSkip(block.id)}
          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md bg-secondary/60 text-foreground/80 text-[11px] font-medium hover:bg-secondary transition-colors"
        >
          <SkipForward className="w-3 h-3" /> skip
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Section primitive — header + body
// ─────────────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between px-2.5 py-1 mb-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/65">
          <Icon className="w-3 h-3" />
          {title}
        </div>
        <span className="text-[9px] font-mono tabular-nums text-muted-foreground/55">
          {count}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground/45">
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Task rows
// ─────────────────────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const color = getTaskColor(task.color ?? task.calendar_color);
  const score = calculateScore(task);
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors group"
    >
      <div
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: color.border, minHeight: '1.25rem' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[12px] font-medium text-foreground/90 truncate leading-tight">
            {task.title || '(untitled)'}
          </span>
          {task.is_recurring && (
            <Repeat className="w-2.5 h-2.5 text-primary/60 shrink-0" />
          )}
          {task.scheduling_mode === 'fixed' && (
            <Pin className="w-2.5 h-2.5 text-muted-foreground/55 shrink-0" />
          )}
          {task.scheduling_mode === 'anchor' && (
            <Shield className="w-2.5 h-2.5 text-muted-foreground/55 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono text-muted-foreground/60 leading-none tabular-nums">
          <span className="flex items-center gap-0.5">
            <Clock className="w-2 h-2" />
            {task.total_duration}m
          </span>
          <span>p{task.priority}</span>
          {task.deadline && (
            <span className="flex items-center gap-0.5 text-amber-300/85">
              <Calendar className="w-2 h-2" />
              {task.deadline.slice(5)}
            </span>
          )}
        </div>
      </div>
      {score >= 4 && (
        <Flame className="w-3 h-3 text-destructive/85 shrink-0" />
      )}
    </button>
  );
}

function DeadlineRow({
  task,
  days,
  onClick,
}: {
  task: Task;
  days: number;
  onClick: () => void;
}) {
  const overdue = days < 0;
  const dueToday = days === 0;
  const Icon = overdue ? AlertOctagon : dueToday ? Clock : Calendar;
  const colorClass = overdue
    ? 'text-destructive'
    : dueToday
    ? 'text-amber-300'
    : days <= 2
    ? 'text-amber-300/80'
    : 'text-muted-foreground/70';

  const label = overdue
    ? `${Math.abs(days)}d late`
    : dueToday
    ? 'today'
    : days === 1
    ? 'tomorrow'
    : `${days}d`;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-2 px-2 py-1 rounded-md hover:bg-secondary/40 transition-colors"
    >
      <Icon className={`w-3 h-3 shrink-0 ${colorClass}`} />
      <span className="flex-1 text-[11px] text-foreground/85 truncate">
        {task.title}
      </span>
      <span className={`text-[9px] font-mono tabular-nums ${colorClass}`}>
        {label}
      </span>
    </button>
  );
}
