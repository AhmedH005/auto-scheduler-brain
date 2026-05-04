/**
 * HorizonCalendar — the week as a horizontal stream.
 *
 * Most calendar apps put time on the Y axis (rows of hours) and days on
 * the X axis (7 columns). That's how Google, Outlook, Apple, Cron, and
 * everyone else does it. The result is a tall narrow grid that fits
 * desktop monitors and looks the same everywhere.
 *
 * We invert: time on the X axis, days on the Y axis.
 *   • You read time left-to-right, the same direction you read text.
 *   • The current moment is one vertical line cutting all 7 days, not
 *     seven separate stripes you have to mentally compose.
 *   • Patterns become visible — "I always book mornings" lights up the
 *     left side; "Thursdays are a wasteland" shows as an empty row.
 *   • The whole week fits in one wide-and-short composition. No scroll.
 *
 * Drag a block horizontally → retime. Drag vertically → change day.
 * 15-minute snap. Click an empty slot → focus composer with stub text.
 *
 * This is the calendar surface. It lives on the home page (not a
 * separate sheet) — there's no view to summon, just a glanceable strip
 * that's also the editing surface.
 */

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  isSameDay,
  isToday,
  startOfDay,
  differenceInMinutes,
  addMinutes,
} from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, Pin } from 'lucide-react';
import { Task, ScheduledBlock, UserSettings } from '@/types/task';
import { getTaskColor } from '@/lib/taskColors';

interface HorizonCalendarProps {
  blocks: ScheduledBlock[];
  tasks: Task[];
  settings: UserSettings;
  selectedDate: Date;
  now: Date;
  onSelectDate: (d: Date) => void;
  onMoveBlock: (id: string, start: string, end: string) => void;
  onTapBlock: (block: ScheduledBlock) => void;
  onTapEmpty: (date: string, time: string) => void;
}

const SNAP_MINUTES = 15;
const ROW_HEIGHT = 44; // px per day row
const RULER_HEIGHT = 22; // px for hour labels
const LABEL_WIDTH = 52; // px for day-of-week labels on left

export function HorizonCalendar({
  blocks,
  tasks,
  settings,
  selectedDate,
  now,
  onSelectDate,
  onMoveBlock,
  onTapBlock,
  onTapEmpty,
}: HorizonCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Time range: respect user's working hours but pad ±1h so they can
  // see early-morning or late-night blocks if any escape the window.
  const startHour = parseInt(settings.working_hours_start.slice(0, 2), 10);
  const endHour = parseInt(settings.working_hours_end.slice(0, 2), 10);
  const rangeStart = Math.max(5, startHour - 1);
  const rangeEnd = Math.min(23, endHour + 2);
  const totalHours = rangeEnd - rangeStart;
  const totalMinutes = totalHours * 60;

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const weekBlocks = useMemo(() => {
    return blocks.filter(b => {
      const d = new Date(b.start_time);
      return d >= weekStart && d < addDays(weekStart, 7);
    });
  }, [blocks, weekStart]);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    rowIdx: number;
    leftPct: number;
    widthPct: number;
  } | null>(null);
  const dragStartRef = useRef<{
    blockId: string;
    pointerX: number;
    pointerY: number;
    origRowIdx: number;
    origLeftPct: number;
    widthPct: number;
    container: DOMRect;
  } | null>(null);

  const minutesToPct = (m: number) => (m / totalMinutes) * 100;

  const blockToCoords = useCallback(
    (b: ScheduledBlock) => {
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);
      const dayStart = startOfDay(start);
      const minStart = differenceInMinutes(start, dayStart) - rangeStart * 60;
      const dur = differenceInMinutes(end, start);
      const rowIdx = days.findIndex(d => isSameDay(d, start));
      return {
        rowIdx,
        leftPct: minutesToPct(minStart),
        widthPct: minutesToPct(dur),
      };
    },
    [days, rangeStart, totalMinutes]
  );

  const onPointerDownBlock = (e: React.PointerEvent, b: ScheduledBlock) => {
    if (b.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current?.getBoundingClientRect();
    if (!container) return;
    const coords = blockToCoords(b);
    dragStartRef.current = {
      blockId: b.id,
      pointerX: e.clientX,
      pointerY: e.clientY,
      origRowIdx: coords.rowIdx,
      origLeftPct: coords.leftPct,
      widthPct: coords.widthPct,
      container,
    };
    setDragId(b.id);
    setDragGhost({
      rowIdx: coords.rowIdx,
      leftPct: coords.leftPct,
      widthPct: coords.widthPct,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragStartRef.current;
    if (!ds) return;
    const dx = e.clientX - ds.pointerX;
    const dy = e.clientY - ds.pointerY;
    const gridWidth = ds.container.width - LABEL_WIDTH;
    const dxPct = (dx / gridWidth) * 100;
    const newLeftPct = Math.max(
      0,
      Math.min(100 - ds.widthPct, ds.origLeftPct + dxPct)
    );
    const rowDelta = Math.round(dy / ROW_HEIGHT);
    const newRowIdx = Math.max(0, Math.min(6, ds.origRowIdx + rowDelta));
    setDragGhost({
      rowIdx: newRowIdx,
      leftPct: newLeftPct,
      widthPct: ds.widthPct,
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const ds = dragStartRef.current;
    const ghost = dragGhost;
    dragStartRef.current = null;
    setDragId(null);
    setDragGhost(null);
    if (!ds || !ghost) return;

    // Snap percentage left back to minutes, snap to 15-min grid
    const minutesFromRangeStart = (ghost.leftPct / 100) * totalMinutes;
    const snapped = Math.round(minutesFromRangeStart / SNAP_MINUTES) * SNAP_MINUTES;
    const newDay = days[ghost.rowIdx];
    const newStart = addMinutes(
      addMinutes(startOfDay(newDay), rangeStart * 60),
      snapped
    );
    const dur = (ghost.widthPct / 100) * totalMinutes;
    const newEnd = addMinutes(newStart, Math.round(dur));

    onMoveBlock(
      ds.blockId,
      format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
      format(newEnd, "yyyy-MM-dd'T'HH:mm:ss")
    );
  };

  const onPointerCancel = () => {
    dragStartRef.current = null;
    setDragId(null);
    setDragGhost(null);
  };

  // Now line: pixel position based on now in the time range
  const nowMinutesIntoRange =
    (now.getHours() - rangeStart) * 60 + now.getMinutes();
  const nowPct = (nowMinutesIntoRange / totalMinutes) * 100;
  const nowVisible =
    isSameDay(now, selectedDate) || // single-day case
    (now >= weekStart && now < addDays(weekStart, 7));

  // Click on empty area in a row → ask composer to add at that time
  const onClickRow = (e: React.MouseEvent, rowIdx: number) => {
    if (dragId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const xRelGrid = e.clientX - rect.left - LABEL_WIDTH;
    const gridW = rect.width - LABEL_WIDTH;
    if (xRelGrid < 0 || xRelGrid > gridW) return;
    const minutes = (xRelGrid / gridW) * totalMinutes;
    const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    const day = days[rowIdx];
    const t = addMinutes(addMinutes(startOfDay(day), rangeStart * 60), snapped);
    onTapEmpty(format(day, 'yyyy-MM-dd'), format(t, 'HH:mm'));
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Top chrome — week nav */}
      <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between">
        <button
          onClick={() => onSelectDate(addWeeks(weekStart, -1))}
          className="w-7 h-7 rounded-lg text-muted-foreground/65 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="text-center">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
            the horizon
          </div>
          <div className="text-[12px] font-mono tabular-nums text-foreground/85 mt-0.5">
            {format(weekStart, 'MMM d')} — {format(addDays(weekStart, 6), 'MMM d')}
          </div>
        </div>
        <button
          onClick={() => onSelectDate(addWeeks(weekStart, 1))}
          className="w-7 h-7 rounded-lg text-muted-foreground/65 hover:text-foreground hover:bg-secondary/40 flex items-center justify-center transition-colors"
          aria-label="Next week"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Canvas — the actual horizon */}
      <div
        ref={containerRef}
        className="relative select-none"
        style={{
          height: RULER_HEIGHT + 7 * ROW_HEIGHT,
          touchAction: 'none',
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Hour ruler */}
        <div
          className="absolute top-0"
          style={{ left: LABEL_WIDTH, right: 0, height: RULER_HEIGHT }}
        >
          {Array.from({ length: totalHours + 1 }).map((_, i) => {
            const hour = rangeStart + i;
            const leftPct = (i / totalHours) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 h-full text-[9px] font-mono text-muted-foreground/40 tabular-nums"
                style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
              >
                {hour.toString().padStart(2, '0')}
              </div>
            );
          })}
        </div>

        {/* Hour gridlines (vertical) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: LABEL_WIDTH,
            right: 0,
            top: RULER_HEIGHT,
            bottom: 0,
          }}
        >
          {Array.from({ length: totalHours + 1 }).map((_, i) => {
            const leftPct = (i / totalHours) * 100;
            const isMajor = i % 3 === 0;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${leftPct}%`,
                  width: 1,
                  background: isMajor
                    ? 'hsl(var(--border) / 0.45)'
                    : 'hsl(var(--border) / 0.15)',
                }}
              />
            );
          })}
        </div>

        {/* Day rows */}
        {days.map((day, idx) => {
          const dayLabel = format(day, 'EEE').toUpperCase();
          const dayNum = format(day, 'd');
          const isTodayRow = isToday(day);
          const isSelected = isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              className="absolute left-0 right-0 flex"
              style={{
                top: RULER_HEIGHT + idx * ROW_HEIGHT,
                height: ROW_HEIGHT,
              }}
            >
              {/* Day label */}
              <button
                onClick={() => onSelectDate(day)}
                className={
                  'shrink-0 flex flex-col items-center justify-center transition-colors ' +
                  (isSelected
                    ? 'bg-primary/8'
                    : 'hover:bg-secondary/25')
                }
                style={{ width: LABEL_WIDTH }}
              >
                <span
                  className={
                    'text-[9px] font-mono uppercase tracking-wider leading-none ' +
                    (isTodayRow ? 'text-primary' : 'text-muted-foreground/50')
                  }
                >
                  {dayLabel}
                </span>
                <span
                  className={
                    'text-[14px] font-semibold tabular-nums leading-tight mt-0.5 ' +
                    (isTodayRow
                      ? 'text-primary'
                      : isSelected
                      ? 'text-foreground'
                      : 'text-foreground/65')
                  }
                >
                  {dayNum}
                </span>
              </button>
              {/* Empty-click hit area — adds a task at the clicked time */}
              <div
                className={
                  'flex-1 relative ' +
                  (isTodayRow ? 'bg-primary/[0.025]' : '') +
                  (idx % 2 === 1 ? ' bg-secondary/[0.04]' : '')
                }
                onClick={e => onClickRow(e, idx)}
                style={{ cursor: 'crosshair' }}
              />
            </div>
          );
        })}

        {/* Now line */}
        {nowVisible && nowPct >= 0 && nowPct <= 100 && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              top: RULER_HEIGHT,
              bottom: 0,
              left: `calc(${LABEL_WIDTH}px + ${nowPct}% - ${(LABEL_WIDTH * nowPct) / 100}px)`,
              width: 1,
              background:
                'linear-gradient(180deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)',
            }}
          >
            <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(255,138,52,0.7)]" />
          </div>
        )}

        {/* Blocks layer */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: LABEL_WIDTH,
            right: 0,
            top: RULER_HEIGHT,
            bottom: 0,
          }}
        >
          {weekBlocks.map(b => {
            const task = taskById.get(b.task_id);
            if (!task) return null;
            const isDragging = dragId === b.id;
            const coords = isDragging && dragGhost
              ? dragGhost
              : blockToCoords(b);
            if (coords.rowIdx < 0) return null;

            const color = getTaskColor(task.color ?? task.calendar_color);
            const isDone = !!b.completed_at;

            return (
              <motion.div
                key={b.id}
                className="absolute pointer-events-auto rounded-md overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                  top: coords.rowIdx * ROW_HEIGHT + 3,
                  left: `${coords.leftPct}%`,
                  width: `${coords.widthPct}%`,
                  height: ROW_HEIGHT - 6,
                  background: `${color.bg}aa`,
                  borderLeft: `3px solid ${color.border}`,
                  opacity: isDragging ? 0.55 : isDone ? 0.55 : 1,
                  zIndex: isDragging ? 30 : 5,
                  boxShadow: isDragging
                    ? `0 12px 32px -10px ${color.border}cc`
                    : 'none',
                }}
                onPointerDown={e => onPointerDownBlock(e, b)}
                onClick={e => {
                  e.stopPropagation();
                  if (!isDragging) onTapBlock(b);
                }}
                whileHover={{ scale: 1.005 }}
                title={`${task.title} · ${format(new Date(b.start_time), 'HH:mm')}–${format(new Date(b.end_time), 'HH:mm')}`}
              >
                <div className="px-1.5 h-full flex items-center gap-1 min-w-0">
                  {b.locked && (
                    <Lock className="w-2 h-2 shrink-0 text-foreground/55" />
                  )}
                  {task.scheduling_mode === 'fixed' && (
                    <Pin className="w-2 h-2 shrink-0 text-foreground/55" />
                  )}
                  <span
                    className={
                      'text-[10px] font-medium truncate leading-none ' +
                      (isDone ? 'line-through text-foreground/55' : 'text-foreground/95')
                    }
                  >
                    {task.title}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer: legend / hint */}
      <div className="px-4 py-2 border-t border-border/60 flex items-center justify-between text-[9px] font-mono text-muted-foreground/45">
        <span>drag to move · click empty to add · {weekBlocks.length} this week</span>
        <span>{rangeStart}:00–{rangeEnd}:00</span>
      </div>
    </div>
  );
}
