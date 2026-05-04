/**
 * TimeStream — the new calendar primitive.
 *
 * NOT a grid. NOT slots. NOT rows-as-time. A vertical scrolling feed of
 * rich block tiles, with explicit labeled gap rows between them, day
 * dividers as banners, and variable card height by duration.
 *
 * Visual model:
 *
 *   ┌──────────────────────────────────┐
 *   │ TODAY · MAY 4                    │  day divider
 *   ├──────────────────────────────────┤
 *   │ ▌ 09:00 ──────────────────────── │
 *   │   Deep Work · Thesis chapter 3   │  block tile (variable height)
 *   │   90 min · deep                  │
 *   │   [Done] [Skip] [Lock]           │
 *   ├──────────────────────────────────┤
 *   │   + 30m free                     │  gap row (collapsible)
 *   ├──────────────────────────────────┤
 *   │ ▌ 11:00 ◉ live ───────────────── │
 *   │   Code review · PR #847          │  live block: pulsing accent
 *   │   60 min · moderate              │
 *   │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  progress bar
 *   ├──────────────────────────────────┤
 *   │ TOMORROW · MAY 5                 │
 *   ├──────────────────────────────────┤
 *   │ ▌ 09:00 ────────────────────────│
 *   │   Deep Work                      │
 *   │ ...                              │
 *   └──────────────────────────────────┘
 *
 * Time is informational, not spatial. The grid metaphor is gone.
 * Empty time isn't blank space; it's a labeled gap row you can click
 * to add a task at that point.
 */

import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  isSameDay,
  differenceInMinutes,
  addDays,
} from 'date-fns';
import {
  Check,
  SkipForward,
  Lock,
  Unlock,
  Pencil,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { ScheduledBlock, Task } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';
import { GoogleIcon } from '@/components/GoogleIcon';

interface TimeStreamProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  /** How many days to render forward from `selectedDate`. 1 = today only,
   *  7 = week-style. The component handles continuity (no grid). */
  daysAhead: number;
  selectedDate: Date;
  onMarkDone: (blockId: string, mins?: number) => void;
  onMarkSkipped: (blockId: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onEditTask: (task: Task) => void;
  onAddInGap: (date: string, time: string, durationMinutes: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────
//  Item types — what the stream renders
// ─────────────────────────────────────────────────────────────────────────

type StreamItem =
  | { kind: 'day-divider'; date: Date }
  | { kind: 'block'; block: ScheduledBlock; live: boolean }
  | { kind: 'gap'; date: string; startTime: string; minutes: number }
  | { kind: 'now-line' }
  | { kind: 'empty-day'; date: Date };

export function TimeStream({
  blocks,
  tasks,
  daysAhead,
  selectedDate,
  onMarkDone,
  onMarkSkipped,
  onLockBlock,
  onUnlockBlock,
  onDeleteBlock,
  onEditTask,
  onAddInGap,
}: TimeStreamProps) {
  // Tick once per minute so the live state + now-line stay current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const now = new Date();
  const nowMs = now.getTime();

  // Build the flat stream of items across daysAhead days
  const items = useMemo(() => buildStream({ blocks, daysAhead, selectedDate, now }), [
    blocks,
    daysAhead,
    selectedDate,
    now,
  ]);

  // Auto-scroll to "now" on first mount when today is in range
  const scrollRef = useRef<HTMLDivElement>(null);
  const nowAnchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (nowAnchorRef.current && scrollRef.current) {
      const anchorRect = nowAnchorRef.current.getBoundingClientRect();
      const containerRect = scrollRef.current.getBoundingClientRect();
      const offset = anchorRect.top - containerRect.top - 120;
      scrollRef.current.scrollBy({ top: offset, behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-[680px] mx-auto px-4 sm:px-8 py-8 sm:py-10">
        <AnimatePresence initial={false}>
          {items.map((item, i) => {
            switch (item.kind) {
              case 'day-divider':
                return <DayDivider key={`day-${item.date.toISOString()}`} date={item.date} />;
              case 'block': {
                const task = taskById.get(item.block.task_id);
                return (
                  <BlockTile
                    key={item.block.id}
                    block={item.block}
                    task={task}
                    live={item.live}
                    now={now}
                    onMarkDone={onMarkDone}
                    onMarkSkipped={onMarkSkipped}
                    onLockBlock={onLockBlock}
                    onUnlockBlock={onUnlockBlock}
                    onDeleteBlock={onDeleteBlock}
                    onEditTask={onEditTask}
                  />
                );
              }
              case 'gap':
                return (
                  <GapRow
                    key={`gap-${item.date}-${item.startTime}-${i}`}
                    date={item.date}
                    startTime={item.startTime}
                    minutes={item.minutes}
                    onAdd={() => onAddInGap(item.date, item.startTime, item.minutes)}
                  />
                );
              case 'now-line':
                return <NowLine key={`now-${i}`} ref={nowAnchorRef} />;
              case 'empty-day':
                return <EmptyDay key={`empty-${item.date.toISOString()}`} date={item.date} />;
              default:
                return null;
            }
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Stream construction
// ─────────────────────────────────────────────────────────────────────────

function buildStream(args: {
  blocks: ScheduledBlock[];
  daysAhead: number;
  selectedDate: Date;
  now: Date;
}): StreamItem[] {
  const { blocks, daysAhead, selectedDate, now } = args;
  const items: StreamItem[] = [];
  const nowMs = now.getTime();

  // Sort blocks chronologically once
  const sorted = [...blocks].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const day = addDays(selectedDate, dayOffset);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    items.push({ kind: 'day-divider', date: day });

    const dayBlocks = sorted.filter(b => isSameDay(new Date(b.start_time), day));
    if (dayBlocks.length === 0) {
      items.push({ kind: 'empty-day', date: day });
      continue;
    }

    let nowLineEmitted = false;
    let cursor: Date | null = null; // tracks end of last placed block

    for (const block of dayBlocks) {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);

      // Inject now-line if it falls before this block (and we haven't yet)
      if (
        !nowLineEmitted &&
        isToday(day) &&
        nowMs > (cursor?.getTime() ?? day.getTime()) &&
        nowMs < blockStart.getTime()
      ) {
        items.push({ kind: 'now-line' });
        nowLineEmitted = true;
      }

      // Inject gap if there's meaningful space between cursor and this block
      if (cursor) {
        const gapMin = differenceInMinutes(blockStart, cursor);
        if (gapMin >= 15) {
          items.push({
            kind: 'gap',
            date: format(day, 'yyyy-MM-dd'),
            startTime: format(cursor, 'HH:mm'),
            minutes: gapMin,
          });
        }
      }

      const live = blockStart.getTime() <= nowMs && nowMs < blockEnd.getTime();
      items.push({ kind: 'block', block, live });

      // If now is inside this block AND we haven't emitted now-line, mark this block as the anchor — done by scrolling to live block instead.
      if (live && !nowLineEmitted) {
        // We don't add a separate now-line when now is inside a block —
        // the live block IS the anchor. Mark emitted to avoid duplicates.
        nowLineEmitted = true;
      }

      cursor = blockEnd;
    }

    // After the last block on today, if now > last block's end, emit now-line at the end
    if (isToday(day) && !nowLineEmitted && cursor && nowMs > cursor.getTime()) {
      items.push({ kind: 'now-line' });
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────
//  DayDivider
// ─────────────────────────────────────────────────────────────────────────

function DayDivider({ date }: { date: Date }) {
  const label = isToday(date)
    ? 'Today'
    : isTomorrow(date)
    ? 'Tomorrow'
    : isYesterday(date)
    ? 'Yesterday'
    : format(date, 'EEEE');

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-baseline gap-3 mt-10 first:mt-0 mb-4"
    >
      <h3 className="text-display text-2xl text-foreground tracking-tight">
        {label}
      </h3>
      <span className="text-eyebrow text-muted-foreground/55">
        {format(date, 'MMM d')}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  BlockTile — the rich "block as feed-card" component
// ─────────────────────────────────────────────────────────────────────────

interface BlockTileProps {
  block: ScheduledBlock;
  task: Task | undefined;
  live: boolean;
  now: Date;
  onMarkDone: (blockId: string, mins?: number) => void;
  onMarkSkipped: (blockId: string) => void;
  onLockBlock: (blockId: string) => void;
  onUnlockBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onEditTask: (task: Task) => void;
}

function BlockTile({
  block,
  task,
  live,
  now,
  onMarkDone,
  onMarkSkipped,
  onLockBlock,
  onUnlockBlock,
  onDeleteBlock,
  onEditTask,
}: BlockTileProps) {
  const [hovered, setHovered] = useState(false);
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const totalMin = Math.max(1, differenceInMinutes(end, start));
  const elapsed = live ? Math.max(0, differenceInMinutes(now, start)) : 0;
  const progress = live ? Math.min(1, elapsed / totalMin) : 0;
  const completed = !!block.completed_at;
  const isPast = end.getTime() < now.getTime() && !completed;

  const taskColor = task ? getTaskColor(task.color) : null;
  const colorHsl = task?.calendar_color ?? taskColor?.border ?? 'hsl(var(--primary))';
  const isSynced = !!task?.sync_source;

  // Variable height by duration: log-scaled so a 4h block isn't 4× visual weight
  const heightCue = Math.max(0, Math.min(1, Math.log2(totalMin / 30) / 4)); // 0..1
  const minPaddingY = 16 + heightCue * 22; // 16..38px

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: completed ? 0.55 : isPast ? 0.7 : 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => task && onEditTask(task)}
      className={`group relative cursor-pointer rounded-xl mb-1.5 transition-all ${
        live
          ? 'bg-card glow-now ring-1 ring-primary/30'
          : completed
          ? 'bg-card/40'
          : 'bg-card/85 hover:bg-card glow-soft hover:scale-[1.005]'
      }`}
    >
      <div
        className="px-5 py-4 flex items-stretch gap-4"
        style={{ paddingTop: minPaddingY, paddingBottom: minPaddingY }}
      >
        {/* Color rail on left */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-1.5">
          <div
            className="w-1.5 flex-1 rounded-full"
            style={{ background: colorHsl, opacity: completed ? 0.4 : 1 }}
          />
        </div>

        {/* Time column */}
        <div className="flex flex-col shrink-0 w-[68px] pt-0.5">
          <span className="text-data-lg tabular-nums text-foreground/85 leading-none">
            {format(start, 'HH:mm')}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/55 mt-1 leading-none tabular-nums">
            {totalMin}m
          </span>
          {live && (
            <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-primary font-bold">
              <span className="w-1 h-1 rounded-full bg-primary pulse-ring" />
              Live
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-0.5">
            <h4
              className={`text-display text-lg sm:text-xl text-foreground tracking-tight leading-snug truncate ${
                completed ? 'line-through decoration-emerald-400/60 decoration-1' : ''
              }`}
              style={completed ? { color: 'hsl(var(--foreground) / 0.6)' } : undefined}
            >
              {task?.title ?? 'Untitled'}
            </h4>
            {isSynced && <GoogleIcon size={11} className="opacity-60 mt-1.5 shrink-0" />}
            {completed && (
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-1.5" strokeWidth={2.5} />
            )}
          </div>

          {task?.description && !completed && (
            <p className="text-body text-muted-foreground/80 leading-relaxed line-clamp-2 mb-2">
              {task.description}
            </p>
          )}

          {/* Metadata + state */}
          <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground/70 leading-none">
            {task && (
              <span className="flex items-center gap-1">
                <EnergyDot energy={task.energy_intensity} />
                {task.energy_intensity}
              </span>
            )}
            {block.locked && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  locked
                </span>
              </>
            )}
            {isPast && !completed && !block.locked && (
              <>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1 text-amber-300/85">
                  <AlertCircle className="w-3 h-3" />
                  awaiting confirm
                </span>
              </>
            )}
          </div>

          {/* Progress bar — only on live */}
          {live && (
            <div className="mt-3">
              <div className="h-0.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono tabular-nums text-muted-foreground/65">
                <span>{elapsed}m elapsed</span>
                <span className="text-primary font-semibold">{totalMin - elapsed}m left</span>
              </div>
            </div>
          )}

          {/* Inline actions — appear on hover or when live */}
          <AnimatePresence>
            {(hovered || live) && task && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5 mt-3 overflow-hidden"
              >
                {!completed && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onMarkDone(block.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                  >
                    <Check className="w-3 h-3" strokeWidth={2.5} />
                    Done
                  </button>
                )}
                {!completed && !isSynced && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onMarkSkipped(block.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-colors"
                  >
                    <SkipForward className="w-3 h-3" />
                    Skip
                  </button>
                )}
                {!isSynced && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      block.locked ? onUnlockBlock(block.id) : onLockBlock(block.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded text-[11px] font-medium bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {block.locked ? (
                      <>
                        <Unlock className="w-3 h-3" />
                        Unlock
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" />
                        Lock
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteBlock(block.id);
                  }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded text-muted-foreground/55 hover:text-destructive transition-colors"
                  aria-label="Delete block"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  GapRow — explicit free-time markers between blocks
// ─────────────────────────────────────────────────────────────────────────

function GapRow({
  date,
  startTime,
  minutes,
  onAdd,
}: {
  date: string;
  startTime: string;
  minutes: number;
  onAdd: () => void;
}) {
  const label =
    minutes < 60
      ? `${minutes}m free`
      : minutes % 60 === 0
      ? `${minutes / 60}h free`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m free`;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onAdd}
      className="group w-full flex items-center gap-3 px-5 py-2.5 rounded-md hover:bg-card/40 transition-colors"
    >
      <div className="w-1.5 h-3 rounded-full border-l border-r border-border/40" />
      <div className="w-[68px] text-[10px] font-mono tabular-nums text-muted-foreground/45 text-left leading-none">
        {startTime}
      </div>
      <span className="text-[11px] font-medium text-muted-foreground/55 group-hover:text-foreground/70 transition-colors flex items-center gap-1.5">
        <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        {label}
      </span>
      <div className="flex-1 h-px bg-border/20" />
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  NowLine — the only "time spatially marked" element
// ─────────────────────────────────────────────────────────────────────────

const NowLine = ({ ref }: { ref?: React.RefObject<HTMLDivElement> }) => (
  <motion.div
    ref={ref as any}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4 }}
    className="flex items-center gap-3 my-3 px-5"
  >
    <span className="relative flex w-2 h-2">
      <span className="absolute inset-0 rounded-full pulse-ring" style={{ background: 'hsl(var(--time-marker))' }} />
      <span className="relative w-2 h-2 rounded-full" style={{ background: 'hsl(var(--time-marker))' }} />
    </span>
    <span className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color: 'hsl(var(--time-marker))' }}>
      Now · {format(new Date(), 'HH:mm')}
    </span>
    <div className="flex-1 h-px" style={{ background: 'hsl(var(--time-marker) / 0.3)' }} />
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────
//  EmptyDay
// ─────────────────────────────────────────────────────────────────────────

function EmptyDay({ date }: { date: Date }) {
  return (
    <div className="ml-[10px] py-6 pl-7 border-l border-border/30 my-2">
      <p className="text-caption text-muted-foreground/50 italic">
        Nothing scheduled.{' '}
        <span className="text-muted-foreground/70 not-italic">⌘K</span> to add.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Tiny atoms
// ─────────────────────────────────────────────────────────────────────────

function EnergyDot({ energy }: { energy: 'deep' | 'moderate' | 'light' }) {
  const color =
    energy === 'deep'
      ? 'hsl(var(--energy-deep))'
      : energy === 'moderate'
      ? 'hsl(var(--energy-moderate))'
      : 'hsl(var(--energy-light))';
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />;
}
