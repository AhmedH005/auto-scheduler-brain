/**
 * NowView — the new primary interface paradigm.
 *
 * Calendar grids show you TIME. AXIS NOW shows you what to DO with it.
 *
 * Layout (vertically stacked, single column, no sidebar):
 *
 *   ┌────────────────────────────────────┐
 *   │  Mode toggle (NOW / PLAN)   ← →    │
 *   ├────────────────────────────────────┤
 *   │                                    │
 *   │      [ FOCAL CARD — current /      │
 *   │        next / free state ]         │
 *   │                                    │
 *   ├────────────────────────────────────┤
 *   │  STREAM — upcoming blocks today    │
 *   │  ▌ 11:00  Read paper               │
 *   │  ▌ 13:00  Lunch                    │
 *   │  ▌ 14:00  Code review              │
 *   │                                    │
 *   │  TOMORROW                          │
 *   │  ▌ 09:00  Deep work                │
 *   │  ▌ 10:30  Standup                  │
 *   └────────────────────────────────────┘
 *
 * The calendar grid is one click away (Plan mode) for bulk editing.
 * Day-to-day execution lives here.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, isSameDay, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import {
  Sparkles,
  Check,
  SkipForward,
  Lock,
  Pencil,
  Clock,
  ChevronRight,
  ArrowRight,
  Coffee,
  Zap,
  AlertOctagon,
  AlertTriangle,
} from 'lucide-react';
import { ScheduledBlock, Task } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';

interface NowViewProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  atRiskCount: number;
  droppedCount: number;
  onMarkDone: (blockId: string, mins?: number) => void;
  onMarkSkipped: (blockId: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onEditTask: (task: Task) => void;
  onOpenRetrospective: () => void;
}

export function NowView({
  blocks,
  tasks,
  atRiskCount,
  droppedCount,
  onMarkDone,
  onMarkSkipped,
  onLockBlock,
  onUnlockBlock,
  onEditTask,
  onOpenRetrospective,
}: NowViewProps) {
  // Tick once a minute so "now" / progress bars update without polling state
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  // Force tick to be referenced so React re-renders
  void tick;

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const now = new Date();

  // Sort all non-completed blocks by start time
  const upcoming = useMemo(() => {
    return blocks
      .filter(b => !b.completed_at)
      .filter(b => new Date(b.end_time) > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [blocks, now]);

  // Find the "focal" block — the one that's currently happening, or
  // the very next one if nothing is live.
  const liveBlock = upcoming.find(b => {
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    return start <= now && now < end;
  });
  const nextBlock = !liveBlock ? upcoming[0] : null;

  // Group upcoming-AFTER-focal into Today / Tomorrow / Later
  const groupedRest = useMemo(() => {
    const skip = liveBlock ?? nextBlock;
    const after = skip ? upcoming.filter(b => b.id !== skip.id) : upcoming;
    const today: ScheduledBlock[] = [];
    const tomorrow: ScheduledBlock[] = [];
    const later: ScheduledBlock[] = [];
    for (const b of after) {
      const d = new Date(b.start_time);
      if (isToday(d)) today.push(b);
      else if (isTomorrow(d)) tomorrow.push(b);
      else later.push(b);
    }
    return { today, tomorrow, later };
  }, [upcoming, liveBlock, nextBlock]);

  const hasNothing = upcoming.length === 0 && blocks.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-dawn">
      <div className="max-w-[760px] mx-auto px-6 sm:px-10 py-8 sm:py-12">
        {/* Greeting */}
        <Greeting />

        {/* Health chips — always visible if there's risk */}
        {(atRiskCount > 0 || droppedCount > 0) && (
          <motion.button
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onOpenRetrospective}
            className="mt-4 mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-border hover:border-foreground/20 transition-colors"
          >
            {droppedCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-red-300">
                <AlertOctagon className="w-3 h-3" />
                {droppedCount} won't fit
              </span>
            )}
            {atRiskCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                {atRiskCount} at risk
              </span>
            )}
            <ChevronRight className="w-3 h-3 text-muted-foreground/55" />
          </motion.button>
        )}

        {/* Focal card */}
        <div className="mt-6 sm:mt-8">
          <AnimatePresence mode="wait">
            {liveBlock ? (
              <FocalCard
                key={`live-${liveBlock.id}`}
                block={liveBlock}
                task={taskById.get(liveBlock.task_id)}
                live={true}
                now={now}
                onMarkDone={onMarkDone}
                onMarkSkipped={onMarkSkipped}
                onLockBlock={onLockBlock}
                onUnlockBlock={onUnlockBlock}
                onEditTask={onEditTask}
              />
            ) : nextBlock ? (
              <FocalCard
                key={`next-${nextBlock.id}`}
                block={nextBlock}
                task={taskById.get(nextBlock.task_id)}
                live={false}
                now={now}
                onMarkDone={onMarkDone}
                onMarkSkipped={onMarkSkipped}
                onLockBlock={onLockBlock}
                onUnlockBlock={onUnlockBlock}
                onEditTask={onEditTask}
              />
            ) : hasNothing ? (
              <EmptyDayCard key="empty" />
            ) : (
              <FreeCard key="free" />
            )}
          </AnimatePresence>
        </div>

        {/* Stream of upcoming */}
        {(groupedRest.today.length + groupedRest.tomorrow.length + groupedRest.later.length) > 0 && (
          <div className="mt-10 sm:mt-14">
            {groupedRest.today.length > 0 && (
              <Section label="Later today">
                {groupedRest.today.map((b, i) => (
                  <StreamRow
                    key={b.id}
                    block={b}
                    task={taskById.get(b.task_id)}
                    delay={i * 0.04}
                    onClick={() => {
                      const t = taskById.get(b.task_id);
                      if (t) onEditTask(t);
                    }}
                  />
                ))}
              </Section>
            )}
            {groupedRest.tomorrow.length > 0 && (
              <Section label="Tomorrow">
                {groupedRest.tomorrow.map((b, i) => (
                  <StreamRow
                    key={b.id}
                    block={b}
                    task={taskById.get(b.task_id)}
                    delay={i * 0.04}
                    onClick={() => {
                      const t = taskById.get(b.task_id);
                      if (t) onEditTask(t);
                    }}
                  />
                ))}
              </Section>
            )}
            {groupedRest.later.length > 0 && (
              <Section label="Later this week">
                {groupedRest.later.slice(0, 8).map((b, i) => (
                  <StreamRow
                    key={b.id}
                    block={b}
                    task={taskById.get(b.task_id)}
                    delay={i * 0.04}
                    showFullDate
                    onClick={() => {
                      const t = taskById.get(b.task_id);
                      if (t) onEditTask(t);
                    }}
                  />
                ))}
                {groupedRest.later.length > 8 && (
                  <p className="text-[11px] text-muted-foreground/55 mt-2 px-1">
                    +{groupedRest.later.length - 8} more — switch to Plan view to see all.
                  </p>
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Greeting — time-aware
// ─────────────────────────────────────────────────────────────────────────

function Greeting() {
  const h = new Date().getHours();
  const greeting =
    h < 5 ? 'Late night'
    : h < 12 ? 'Good morning'
    : h < 17 ? 'Good afternoon'
    : h < 22 ? 'Good evening'
    : 'Late night';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="text-eyebrow text-primary/85">{format(new Date(), 'EEEE · MMM d')}</p>
      <h1 className="text-display text-3xl sm:text-4xl text-foreground tracking-tight mt-1">
        {greeting}.
      </h1>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  FocalCard — the dominant element
// ─────────────────────────────────────────────────────────────────────────

interface FocalCardProps {
  block: ScheduledBlock;
  task: Task | undefined;
  live: boolean;
  now: Date;
  onMarkDone: (blockId: string, mins?: number) => void;
  onMarkSkipped: (blockId: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onEditTask: (task: Task) => void;
}

function FocalCard({
  block,
  task,
  live,
  now,
  onMarkDone,
  onMarkSkipped,
  onLockBlock,
  onUnlockBlock,
  onEditTask,
}: FocalCardProps) {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const totalMin = Math.max(1, differenceInMinutes(end, start));
  const elapsedMin = live ? Math.max(0, differenceInMinutes(now, start)) : 0;
  const remainingMin = live ? Math.max(0, differenceInMinutes(end, now)) : totalMin;
  const progress = live ? Math.min(1, elapsedMin / totalMin) : 0;

  const taskColor = task ? getTaskColor(task.color) : null;
  const colorHsl = task?.calendar_color ?? taskColor?.border ?? 'hsl(var(--primary))';

  const minutesUntilStart = !live ? Math.max(0, differenceInMinutes(start, now)) : 0;
  const minutesUntilLabel = (() => {
    if (live) return null;
    if (minutesUntilStart < 1) return 'starting now';
    if (minutesUntilStart < 60) return `in ${minutesUntilStart}m`;
    const h = Math.floor(minutesUntilStart / 60);
    const m = minutesUntilStart % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`relative rounded-2xl overflow-hidden ${
        live ? 'glow-now bg-card' : 'glow-soft bg-card/85'
      }`}
    >
      {/* Color bar on left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: colorHsl }}
      />

      <div className="px-7 py-7 sm:px-9 sm:py-8 pl-8 sm:pl-10">
        {/* Status row */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
            {live ? (
              <>
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full pulse-ring" style={{ background: 'hsl(var(--time-marker))' }} />
                  <span className="relative w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--time-marker))' }} />
                </span>
                <span className="text-time-marker font-semibold" style={{ color: 'hsl(var(--time-marker))' }}>
                  Live now
                </span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 text-primary/85" />
                <span className="text-primary/85 font-semibold">Up next · {minutesUntilLabel}</span>
              </>
            )}
          </div>
          <span className="text-data text-muted-foreground">
            {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-display text-2xl sm:text-3xl text-foreground tracking-tight leading-snug mb-2">
          {task?.title ?? 'Block'}
        </h2>

        {/* Description */}
        {task?.description && (
          <p className="text-body text-muted-foreground/85 leading-relaxed max-w-[520px] mb-5">
            {task.description}
          </p>
        )}

        {/* Energy + duration meta */}
        <div className="flex items-center gap-3 mb-6 text-[11px] font-medium text-muted-foreground/85">
          {task && (
            <span className="flex items-center gap-1">
              <EnergyDot energy={task.energy_intensity} />
              {task.energy_intensity}
            </span>
          )}
          <span className="text-border">·</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {totalMin} min
          </span>
          {block.locked && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                locked
              </span>
            </>
          )}
        </div>

        {/* Progress bar — live blocks only */}
        {live && (
          <div className="mb-6">
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                className="h-full rounded-full"
                style={{ background: 'hsl(var(--primary))' }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] font-mono tabular-nums text-muted-foreground/75">
              <span>{elapsedMin}m elapsed</span>
              <span className="text-primary/85 font-semibold">{remainingMin}m left</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onMarkDone(block.id)}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold hover:brightness-110 transition-all"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            {live ? 'Done' : 'Mark done'}
          </button>
          <button
            onClick={() => onMarkSkipped(block.id)}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-secondary/80 text-foreground/80 text-[13px] font-medium hover:bg-secondary transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
          <button
            onClick={() => block.locked ? onUnlockBlock(block.id) : onLockBlock(block.id)}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
            aria-label={block.locked ? 'Unlock' : 'Lock'}
            title={block.locked ? 'Unlock' : 'Lock — engine won\'t move this'}
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
          {task && (
            <button
              onClick={() => onEditTask(task)}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-secondary/40 text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
              aria-label="Edit task"
              title="Edit task"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  FreeCard — when there's no live block but more is upcoming
//  EmptyDayCard — when nothing is scheduled
// ─────────────────────────────────────────────────────────────────────────

function FreeCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-card/40 border border-border/40 px-7 py-8 text-center"
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
        <Coffee className="w-5 h-5 text-primary" strokeWidth={1.6} />
      </div>
      <h2 className="text-display text-xl text-foreground tracking-tight mb-1">Free time</h2>
      <p className="text-body text-muted-foreground/75 max-w-[320px] mx-auto leading-relaxed">
        Nothing scheduled right now. Use it on the day's next block, take a break,
        or quick-add something with ⌘K.
      </p>
    </motion.div>
  );
}

function EmptyDayCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border/40 px-7 py-12 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-primary/12 mx-auto mb-4 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-primary" strokeWidth={1.6} />
      </div>
      <h2 className="text-display text-xl text-foreground tracking-tight mb-2">A clean slate.</h2>
      <p className="text-body text-muted-foreground/75 max-w-[340px] mx-auto leading-relaxed mb-5">
        Add a task and AXIS will place it where it fits best. Press ⌘K or A to add.
      </p>
      <p className="text-[11px] font-mono text-muted-foreground/55">
        ⌘K · search · A · add task · R · rebuild
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Stream rows
// ─────────────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="text-eyebrow mb-3 text-muted-foreground/65">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StreamRow({
  block,
  task,
  delay = 0,
  showFullDate,
  onClick,
}: {
  block: ScheduledBlock;
  task: Task | undefined;
  delay?: number;
  showFullDate?: boolean;
  onClick?: () => void;
}) {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const taskColor = task ? getTaskColor(task.color) : null;
  const colorHsl = task?.calendar_color ?? taskColor?.border ?? 'hsl(var(--muted-foreground))';
  const dur = differenceInMinutes(end, start);

  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.28, ease: [0.2, 0, 0, 1] }}
      onClick={onClick}
      className="w-full group flex items-center gap-4 px-3 py-2.5 rounded-md hover:bg-card/60 transition-colors text-left"
    >
      {/* Time slot */}
      <span className="shrink-0 w-[72px] text-data tabular-nums text-muted-foreground/70 group-hover:text-foreground transition-colors">
        {showFullDate ? format(start, 'EEE HH:mm') : format(start, 'HH:mm')}
      </span>

      {/* Color bar */}
      <span
        className="shrink-0 w-0.5 h-7 rounded-full transition-all group-hover:w-1"
        style={{ background: colorHsl }}
      />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-body font-medium text-foreground/90 truncate group-hover:text-foreground">
          {task?.title ?? 'Block'}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground/55 mt-0.5 tabular-nums">
          {dur}m
          {task && task.energy_intensity !== 'moderate' && (
            <> · {task.energy_intensity}</>
          )}
          {block.locked && <> · locked</>}
        </p>
      </div>

      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground/60 transition-colors shrink-0" />
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Tiny atoms
// ─────────────────────────────────────────────────────────────────────────

function EnergyDot({ energy }: { energy: 'deep' | 'moderate' | 'light' }) {
  const color =
    energy === 'deep' ? 'hsl(var(--energy-deep))'
    : energy === 'moderate' ? 'hsl(var(--energy-moderate))'
    : 'hsl(var(--energy-light))';
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />;
}
